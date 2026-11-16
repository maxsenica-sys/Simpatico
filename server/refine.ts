import { slangFor } from "./slang";
import { phrasebookTag } from "./phrasebook";
import Anthropic from "@anthropic-ai/sdk";
import { baseLang, langInfo } from "../shared/lang";
import type { SpeakerProfile } from "../shared/protocol";
import { soundsAlike } from "../shared/soundalike";
import { log } from "./log";
import { vocabExtra } from "./vocab";

export type ContextLine = { who: string; lang: string; text: string };

/**
 * "English (Australia)" rather than "English": slang depends on where the speaker is from
 * ("pissed" is drunk in Australia and Britain, angry in America; "thongs" are flip-flops).
 */
function langName(code: string): string {
  const name = langInfo(code).name;
  const region = code.split("-")[1];
  if (!region) return name;
  try {
    const r = new Intl.DisplayNames(["en"], { type: "region" }).of(region.toUpperCase());
    return r && r !== region ? `${name} (${r})` : name;
  } catch {
    return name;
  }
}

/** What the people in this caption pipeline told us about themselves (all optional). */
export type People = { speaker?: "m" | "f"; listener?: "m" | "f" };

/**
 * Only pass a gender when the words need it: from English, the speaker's when they talk about
 * themselves ("I…", or thanks: Portuguese "obrigada") and the listener's when they're addressed
 * ("you"). Otherwise a small model tends to put the speaker's gender on everyone in the sentence
 * ("my teacher was happy with us" coming out feminine). Other source languages mark person in
 * verb endings, so the gender is always passed and the prompt rules apply.
 */
export function relevantPeople(text: string, sourceLang: string, p: People | undefined): People | undefined {
  if (!p || baseLang(sourceLang) !== "en") return p;
  const speaker = p.speaker && /\b(I|I'm|I've|I'll|I'd|thanks?)\b/i.test(text) ? p.speaker : undefined;
  const listener = p.listener && /\b(you|you're|you've|you'll|you'd|your|yours|yourself)\b/i.test(text) ? p.listener : undefined;
  return speaker || listener ? { speaker, listener } : undefined;
}

/**
 * Who is in the call, plus words in what was heard that sound like one of their names (an
 * English speaker saying "Ezgi" is often transcribed "esky"). The model decides from the
 * sentence whether the word is the name or its ordinary meaning.
 */
export function namesTag(names: string[] | undefined, heard: string, speaker?: string, saved?: string[]): string {
  const people = [...new Set((names ?? []).map((n) => n.trim()).filter((n) => n && !/^[A-Z]$/.test(n)))];
  const words = [...new Set((saved ?? []).map((w) => w.trim()).filter((w) => w.length >= 2 && !people.includes(w)))].slice(0, 30);
  if (!people.length && !words.length) return "";
  const known = [...people, ...words];
  const heardWords = heard.split(/[^\p{L}'’-]+/u).filter((w) => w.length >= 1);
  // Single words, and two short words heard as one ("me a" for "Mia").
  const candidates = new Set<string>(heardWords.filter((w) => w.length >= 2));
  for (let i = 0; i + 1 < heardWords.length; i++) if (heardWords[i].length <= 4 && heardWords[i + 1].length <= 4) candidates.add(`${heardWords[i]} ${heardWords[i + 1]}`);
  const hints: string[] = [];
  for (const w of candidates) {
    const flat = w.replace(/\s+/g, "");
    const name = known.find((n) => n.split(/\s+/).some((part) => soundsAlike(flat, part) && flat.toLowerCase() !== part.toLowerCase()));
    if (name) hints.push(`"${w}" may be ${name}`);
  }
  const listed = people.map((n) => (n === speaker?.trim() ? `${n} (speaking now)` : n)).join(", ");
  return [
    people.length ? `<people_in_call>${listed}</people_in_call>` : "",
    words.length ? `<their_names_and_words>${words.join(", ")}</their_names_and_words>` : "",
    hints.length ? `<name_hints>${hints.join("; ")}</name_hints>` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** What the speaker told us about themselves in their profile (all optional). */
function profileTag(p: SpeakerProfile | undefined): string {
  if (!p) return "";
  const parts: string[] = [];
  if (p.from) {
    let country = p.from;
    try {
      country = new Intl.DisplayNames(["en"], { type: "region" }).of(p.from) ?? p.from;
    } catch {}
    parts.push(`From: ${country} (their accent and slang).`);
  }
  if (p.topics?.length) parts.push(`Often talks about: ${p.topics.join(", ")}.`);
  if (p.words?.length) parts.push(`Names and words they use (spell them this way): ${p.words.join(", ")}.`);
  return parts.length ? `<speaker_profile>${parts.join(" ")}</speaker_profile>` : "";
}

function peopleTag(p: People | undefined): string {
  const parts: string[] = [];
  const sp = p?.speaker === "f" ? ["a woman", "feminine", "she", "herself"] : p?.speaker === "m" ? ["a man", "masculine", "he", "himself"] : null;
  const li = p?.listener === "f" ? ["a woman", "feminine", "she"] : p?.listener === "m" ? ["a man", "masculine", "he"] : null;
  if (sp) parts.push(`The speaker is ${sp[0]}: use ${sp[1]} forms only where ${sp[2]} refers to ${sp[3]} alone (I, me, my). This says nothing about "we" or "us", or about anyone ${sp[2]} mentions (friends, teachers, colleagues, family): for them use the context, else neutral wording or the grammatical default.`);
  if (li) parts.push(`The listener is ${li[0]}: use ${li[1]} forms only where ${li[2]} alone is addressed as "you".`);
  return parts.length ? `<people>${parts.join(" ")}</people>` : "";
}

export type RefineInput = {
  /** Finalised source-language transcript of the utterance (not the machine translation). */
  source: string;
  sourceLang: string;
  targetLang: string;
  /** Which participant is speaking, matching the labels used in `context`. */
  speaker: string;
  /** Up to the last 6 utterances of the conversation, both sides, oldest first. */
  context: ContextLine[];
  glossary: Record<string, string>;
  people?: People;
  profile?: SpeakerProfile;
  /** First names of everyone in the call (they are shown on screen anyway). */
  callNames?: string[];
  /** Names and words people in the call saved (pets, places, nicknames): recognition may mishear them. */
  callWords?: string[];
  /** Which of them is speaking. */
  speakerName?: string;
  signal: AbortSignal;
};

const MODEL = process.env.REFINE_MODEL ?? "claude-haiku-5-5";

const SYSTEM = `You write the subtitles for a live, face-to-face video call between two people who do not share a language. Each turn you get one thing a person just said, transcribed from their speech, and you write it in the target language the way a native speaker would actually say it in conversation.

- Translate meaning, not words. Idioms, slang, figures of speech and colloquialisms become the natural equivalent in the target language; where there is none, say plainly what was meant.
- Keep the speaker's register and tone. Casual stays casual, teasing stays teasing, affectionate stays affectionate, blunt stays blunt. Do not soften, formalise or censor.
- The transcript comes from speech recognition and can contain mistakes, fillers and false starts. Use the recent conversation to work out what was meant. Drop fillers that carry no meaning.
- Speech recognition often mishears names, characters, brands, places and slang, especially in accents or soft speech ("pin okio" for Pinocchio, "chillin like a villain" split oddly, a name spelled like ordinary words). When a word or phrase looks like a mishearing of a well-known name or saying, translate what was clearly meant. Names of people and characters are kept (or written the way the target language usually writes them).
- Keep it as short as the natural spoken version. It is read as a subtitle while watching the speaker's face.
- Never add anything that wasn't said: no extra items, words, sentences or explanations, even if they seem helpful.
- Glossary entries are names, nicknames and in-jokes between these two people. Use them as given. <speaker_profile> says where the speaker is from, what they often talk about and names and words they use: use it to read their slang and spell their words.
- <people_in_call> lists who is on this call. Speech recognition often turns a name said in another accent into a similar-sounding word (an English speaker saying the Turkish name "Ezgi" can come out as "esky"); <name_hints> points these out. If the word works as a name in the sentence (someone is spoken to, or something is said about them), write the person's name. If it clearly has its ordinary meaning ("grab the esky from the car"), keep that. Never add a name that wasn't said.
- <their_names_and_words> are names and words these people use (a pet, family, places, nicknames). Recognition may hear them as similar-sounding ordinary words or split them ("me a" for "Mia"); <name_hints> points these out. When the sentence makes sense with the saved name, write the name, unchanged.
- <phrasebook> gives the meaning of set phrases and idioms just said, with what people really say for it in the target language. Use that equivalent when it fits the sentence; never mention the phrasebook.
- Some words mean different things by region or context (Australian "footy" is AFL in most states but rugby league in New South Wales and Queensland; "football" differs by country). Decide from the conversation, the speaker's region and topics; if it is still unclear, keep the neutral meaning ("football", "the game") rather than guessing.
- Gender: <people> gives the speaker's and listener's gender. Use the speaker's only where the speaker refers to themselves (I, me, my: Russian "я устала", Portuguese "obrigada", Hindi "मैं गई"), and the listener's only where they are addressed as one person (you: Arabic "أنتِ", Spanish "¿estás cansada?"). Everyone else follows the conversation: people mentioned get the gender the context gives them, groups stay plural ("Are they coming?" about several people), "we" is the group, and where nothing says otherwise use neutral wording or the grammatical default. Never put the speaker's or listener's gender on anyone else: a woman saying "My friend is tired" in French is "Mon ami est fatigué" (the friend's gender is unknown), not "Mon amie est fatiguée". The source can show gender too (Russian past tenses, Hindi and Urdu verb endings, Thai "ครับ"/"ค่ะ", Arabic and Hebrew verb forms): use those clues. Never add a gender the source doesn't have: Turkish "o", Persian "u", Indonesian "dia", spoken Chinese "tā" become "they" (or the person's name) in English, never "he/she" or a slash. Example: "O da geliyor mu?" is "Are they coming too?", not "Is he coming too?".
- Render interjections and backchannels ("mm-hmm", "uh-huh", "wow", "oh no") with the target language's own spoken equivalent, never the source-language sound.
- Your whole reply appears on screen as the subtitle, so reply with the translation only, written in the target language and its usual script: no quotes, notes, alternatives, transliteration, second attempts or explanations. If the utterance has no translatable content, reply with it unchanged.`;

/**
 * Shared reference for both prompts: everyday slang and spoken particles in the app's main languages.
 * Static text placed last in the system prompt and marked for caching, so it adds no per-call latency
 * once warm (Haiku 5.5 caches prompts of 512+ tokens; this keeps both prompts above that).
 */
// The slang reference lives in server/slang/: one file per language, loaded per call.

/**
 * Last line of defence for what reaches the screen: with thinking off, a model can occasionally
 * second-guess itself in the visible reply ("Wait, the target is English…"). Keep the final
 * subtitle line and drop anything that reads as a note to itself.
 */
/** Signs that a reply is the model talking to itself rather than a subtitle. */
const SELF_TALK = /(["”»]\s*[—–-]+\s*(no|wait|actually|hmm|or)\b|\b(is an exclamation|is a nickname|is slang for|literally means|here means|so the (subtitle|translation)|the translation (is|would be))\b|,\s*so:\s*["“])/i;

export function subtitleOnly(text: string): string {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^(wait|note|actually|hmm|let me|i should|i need|translation\s*:|subtitle\s*:)/i.test(l));
  const line = lines.length > 1 ? lines[lines.length - 1] : (lines[0] ?? "");
  // A continuation sometimes opens with "..." — the screen shows it joined to what came before.
  let out = line.replace(/^(\.\.\.|…)\s*/u, "").trim();
  // Thinking out loud on one line ('"Oh come on…" — no, "oha" is an exclamation…, so: "No way…"'):
  // keep only the final quoted subtitle; with nothing quoted to keep, show nothing (it's retried).
  if (SELF_TALK.test(out)) {
    const quoted = [...out.matchAll(/["“„«]([^"“”„«»]{2,})["”»]/gu)].map((m) => m[1].trim());
    out = quoted.length ? quoted[quoted.length - 1] : "";
  }
  // A subtitle wrapped in quotes as a whole: drop the quotes (quotes inside are kept).
  const q = out.match(/^["“„«'‘](.+)["”»'’]$/su);
  if (q && !/["“”«»]/u.test(q[1])) out = q[1].trim();
  return out;
}

/**
 * True when a "translation" is really the source handed back (same words), e.g. Turkish in,
 * Turkish out. Treated as a failure so it is retried or replaced, never shown as a caption.
 */
export function looksUntranslated(source: string, out: string): boolean {
  // The test mocks echo their input on purpose.
  if (process.env.ECHO_CHECK === "off") return false;
  const words = (t: string) => t.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const a = words(source);
  const b = words(out);
  if (a.length < 3 || b.length < 3) return false; // names, "OK", short loanwords are fine
  const src = new Set(a);
  const same = b.filter((w) => src.has(w)).length;
  return same / b.length >= 0.8;
}

/** The slang reference for this call's two languages, plus approved additions from reports. */
function slangReference(sourceLang: string, targetLang: string): string {
  return slangFor(sourceLang, targetLang, vocabExtra().slang ?? {});
}

let client: Anthropic | null = null;
let warned = false;

export function refineConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** Pass 2: idiomatic rewrite of one finalised utterance. Returns null on any failure. */
export async function refine(input: RefineInput): Promise<string | null> {
  if (!refineConfigured()) {
    if (!warned) log("refine_disabled", { reason: "ANTHROPIC_API_KEY not set" });
    warned = true;
    return null;
  }
  client ??= new Anthropic();
  const src = langName(input.sourceLang);
  const tgt = langName(input.targetLang);
  const glossary = Object.entries(input.glossary);
  const context = input.context.map((c) => `${c.who} (${langInfo(c.lang).name}): ${c.text}`).join("\n");

  const user = [
    `<languages>${src} to ${tgt}</languages>`,
    glossary.length ? `<glossary>\n${glossary.map(([k, v]) => `${k} = ${v}`).join("\n")}\n</glossary>` : "",
    context ? `<recent_conversation>\n${context}\n</recent_conversation>` : "",
    peopleTag(relevantPeople(input.source, input.sourceLang, input.people)),
    profileTag(input.profile),
    namesTag(input.callNames, input.source, input.speakerName, input.callWords),
    phrasebookTag(input.source, input.sourceLang, input.targetLang),
    `<utterance speaker="${input.speaker}">${input.source}</utterance>`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const started = Date.now();
  try {
    const res = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 400,
        // Latency matters more than depth here: a subtitle rewrite needs no reasoning pass.
        thinking: { type: "disabled" },
        output_config: { effort: "medium" },
        system: [{ type: "text", text: SYSTEM }, { type: "text", text: slangReference(input.sourceLang, input.targetLang), cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: user }],
      },
      { signal: input.signal, maxRetries: 0 },
    );
    if (res.stop_reason === "refusal") {
      log("refine_refused", { ms: Date.now() - started });
      return null;
    }
    const raw = res.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("");
    const text = subtitleOnly(raw);
    if (text && looksUntranslated(input.source, text)) {
      log("refine_untranslated", { ms: Date.now() - started, src: input.sourceLang, tgt: input.targetLang });
      return null;
    }
    log("refine_ok", { ms: Date.now() - started, src: input.sourceLang, tgt: input.targetLang, cached: res.usage.cache_read_input_tokens ?? 0 });
    return text || null;
  } catch (err) {
    const aborted = input.signal.aborted;
    log(aborted ? "refine_late" : "refine_error", { ms: Date.now() - started, error: aborted ? undefined : String(err) });
    return null;
  }
}

const PHRASE_SYSTEM = `You write the subtitles for a live video call between people who do not share a language. People here often talk for a long time without pausing, so the subtitle is built phrase by phrase: each turn you get the next finished phrase of what the speaker is saying, and your translation is added after the subtitle already on screen. Nothing on screen is ever changed afterwards, so the reader only ever reads each part once.

- Translate only the new phrase, so that it reads as the natural continuation of the subtitle already shown. Never repeat, correct or rephrase what is already shown. Because of word order, the subtitle so far may already carry part of this phrase's meaning (a "when", "that" or "and" placed earlier); don't translate that part again.
- Translate meaning, not words. Idioms, slang and colloquialisms become the natural equivalent in the target language; keep the speaker's register and tone. Drop fillers and false starts that carry no meaning. Never add anything that wasn't said.
- If the phrase stops mid-sentence, stop there too; do not guess what comes next. In languages where the verb comes last (Turkish, Hindi, Urdu, Bengali, Japanese, Korean), a phrase often arrives before its verb: translate only what is there and never invent the missing verb; it comes with the next phrase, so place it naturally then. When the phrase is marked final, it is the end of what they said: finish the sentence naturally.
- <people_in_call> and <name_hints>: a word that sounds like someone in the call (an English speaker's "esky" for the Turkish name "Ezgi") is that person's name when it works as a name in the sentence; otherwise keep its ordinary meaning.
- <their_names_and_words> are names and words these people use (a pet, family, places, nicknames). Recognition may hear them as similar-sounding ordinary words or split them ("me a" for "Mia"); <name_hints> points these out. When the sentence makes sense with the saved name, write the name, unchanged.
- <phrasebook> gives the meaning of set phrases and idioms just said, with what people really say for it in the target language. Use that equivalent when it fits the sentence; never mention the phrasebook.
- Words that differ by region or context (Australian "footy": AFL or rugby league) follow the conversation and <speaker_profile>; if still unclear, keep the neutral meaning rather than guessing.
- Gender: <people> gives the speaker's and listener's gender. Apply the speaker's only where they refer to themselves (I, me, my) and the listener's only where they are addressed as one person (you). Everyone else follows the conversation: groups stay plural, people mentioned get the gender the context gives them, otherwise neutral wording. Never put the speaker's gender on a friend, colleague or anyone else they mention. Clues in the source (verb endings, Thai "ครับ"/"ค่ะ") count too. Never add a gender the source doesn't have: Turkish "o", Indonesian "dia" and similar become just "they" (or the person's name) in English, never "he/she".
- The transcript comes from speech recognition and can contain mistakes, especially names, characters and slang in accents or soft speech ("pin okio" for Pinocchio). Use what was said before and the recent conversation to work out what was meant, but translate only the new phrase.
- Your whole reply appears on screen: the translation of the new phrase only, in the target language and its usual script, with no notes or alternatives. Only if the phrase is nothing but fillers ("um", "you know"), reply with nothing.`;

export type PhraseInput = {
  /** The next finished phrase of the utterance, in the source language. */
  phrase: string;
  /** What the speaker already said earlier in this utterance (source language). */
  before: string;
  /** The subtitle already on screen for this utterance (target language). */
  shown: string;
  /** This phrase ends what they said. */
  final: boolean;
  sourceLang: string;
  targetLang: string;
  context: ContextLine[];
  people?: People;
  profile?: SpeakerProfile;
  callNames?: string[];
  /** Names and words people in the call saved (pets, places, nicknames): recognition may mishear them. */
  callWords?: string[];
  speakerName?: string;
  signal: AbortSignal;
  /** Stream the reply: called with the subtitle so far as the words are written (Live previews). */
  onPartial?: (text: string) => void;
};

/** The first line of a reply still being written, cleaned like a finished one. Empty while unsure. */
function partialSubtitle(raw: string): string {
  const first = raw.split("\n")[0];
  if (/^(wait|note|actually|hmm|let me|i should|i need|translation\s*:|subtitle\s*:)/i.test(first.trim())) return "";
  return first.replace(/^\s*(\.\.\.|…)\s*/u, "").replace(/^["“„«'‘]/u, "").trim();
}

/**
 * Steady captions: translate one finished phrase of a long utterance as a continuation of the
 * subtitle already shown, so text is only ever appended, never rewritten. Null on failure;
 * an empty string when the phrase needs no subtitle.
 */
export async function phraseTranslate(input: PhraseInput): Promise<string | null> {
  if (!refineConfigured()) return null;
  client ??= new Anthropic();
  const src = langName(input.sourceLang);
  const tgt = langName(input.targetLang);
  // Live previews are thrown away within a second: the last couple of lines are context enough.
  const lines = input.onPartial ? input.context.slice(-2) : input.context;
  const context = lines.map((c) => `${c.who} (${langInfo(c.lang).name}): ${c.text}`).join("\n");
  const user = [
    `<languages>${src} to ${tgt}</languages>`,
    context ? `<recent_conversation>\n${context}\n</recent_conversation>` : "",
    peopleTag(relevantPeople(`${input.before.split(/\s+/).slice(-12).join(" ")} ${input.phrase}`, input.sourceLang, input.people)),
    profileTag(input.profile),
    namesTag(input.callNames, `${input.before} ${input.phrase}`, input.speakerName, input.callWords),
    phrasebookTag(`${input.before.split(/\s+/).slice(-12).join(" ")} ${input.phrase}`, input.sourceLang, input.targetLang),
    input.before ? `<said_so_far>${input.before}</said_so_far>` : "",
    input.shown ? `<subtitle_so_far>${input.shown}</subtitle_so_far>` : "",
    `<new_phrase final="${input.final}">${input.phrase}</new_phrase>`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const started = Date.now();
  const params = {
    model: MODEL,
    max_tokens: 300,
    thinking: { type: "disabled" as const },
    output_config: { effort: "medium" as const },
    system: [{ type: "text" as const, text: PHRASE_SYSTEM }, { type: "text" as const, text: slangReference(input.sourceLang, input.targetLang), cache_control: { type: "ephemeral" as const } }],
    messages: [{ role: "user" as const, content: user }],
  };
  try {
    let res: Anthropic.Message;
    if (input.onPartial) {
      // Live previews: show the words as they are written instead of after the whole reply.
      const stream = client.messages.stream(params, { signal: input.signal, maxRetries: 0 });
      let acc = "";
      let firstAt = 0;
      stream.on("text", (delta) => {
        acc += delta;
        firstAt ||= Date.now() - started;
        const partial = partialSubtitle(acc);
        if (partial) input.onPartial!(partial);
      });
      res = await stream.finalMessage();
      if (firstAt) log("phrase_first_text", { ms: firstAt });
    } else {
      res = await client.messages.create(params, { signal: input.signal, maxRetries: 0 });
    }
    if (res.stop_reason === "refusal") return null;
    const raw = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    log("phrase_ok", { ms: Date.now() - started, chars: input.phrase.length, final: input.final, cached: res.usage.cache_read_input_tokens ?? 0 });
    // Test harness only: never set in production, where no words of a conversation are logged.
    if (process.env.DEBUG_PHRASES === "1") console.log(JSON.stringify({ phrase: input.phrase, final: input.final, out: raw }));
    const text = subtitleOnly(raw);
    if (text && looksUntranslated(input.phrase, text)) {
      log("phrase_untranslated", { ms: Date.now() - started });
      return null;
    }
    return text;
  } catch (err) {
    log(input.signal.aborted ? "phrase_late" : "phrase_error", { ms: Date.now() - started, error: input.signal.aborted ? undefined : String(err) });
    return null;
  }
}
