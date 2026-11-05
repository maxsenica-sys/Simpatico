import Anthropic from "@anthropic-ai/sdk";
import { langInfo } from "../shared/lang";
import { log } from "./log";

export type ContextLine = { who: string; lang: string; text: string };

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
  signal: AbortSignal;
};

const MODEL = process.env.REFINE_MODEL ?? "claude-haiku-5-5";

const SYSTEM = `You write the subtitles for a live, face-to-face video call between two people who do not share a language. Each turn you get one thing a person just said, transcribed from their speech, and you write it in the target language the way a native speaker would actually say it in conversation.

- Translate meaning, not words. Idioms, slang, figures of speech and colloquialisms become the natural equivalent in the target language; where there is none, say plainly what was meant.
- Keep the speaker's register and tone. Casual stays casual, teasing stays teasing, affectionate stays affectionate, blunt stays blunt. Do not soften, formalise or censor.
- The transcript comes from speech recognition and can contain mistakes, fillers and false starts. Use the recent conversation to work out what was meant. Drop fillers that carry no meaning.
- Keep it as short as the natural spoken version. It is read as a subtitle while watching the speaker's face.
- Glossary entries are names, nicknames and in-jokes between these two people. Use them as given.
- You don't know anyone's gender (speaker, listener or people mentioned) unless the conversation makes it clear. Where the target language marks gender (verb endings, adjectives, pronouns), prefer natural phrasing that avoids committing to one; if that isn't possible, use the grammatical default. Never add a gender the source doesn't have: Turkish "o", Persian "u", Indonesian "dia", Chinese spoken "tā" become "they" (or the person's name) in English: just "they", never "he/she" or a slash. Example: "O da geliyor mu?" is "Are they coming too?", not "Is he coming too?".
- Render interjections and backchannels ("mm-hmm", "uh-huh", "wow", "oh no") with the target language's own spoken equivalent, never the source-language sound.
- Your whole reply appears on screen as the subtitle, so reply with the translation only, written in the target language and its usual script: no quotes, notes, alternatives, transliteration, second attempts or explanations. If the utterance has no translatable content, reply with it unchanged.`;

/**
 * Shared reference for both prompts: everyday slang and spoken particles in the app's main languages.
 * Static text placed last in the system prompt and marked for caching, so it adds no per-call latency
 * once warm (Haiku 5.5 caches prompts of 512+ tokens; this keeps both prompts above that).
 */
const SLANG = `<spoken_language_reference>
People on these calls talk casually: friends, families, teammates. Below are common slang words, particles and set phrases by language. They are examples, not a complete list. They are written in Latin letters here, but the transcript uses each language's own script, and speech recognition may spell them oddly. Read them by meaning, and when the target language has its own casual equivalent at the same register, use it.

English: "no cap" = honestly; "lowkey" = a bit, quietly; "bet" = OK, deal; "deadass" = seriously; "slaps" = is great; "sus" = suspicious; "my bad" = sorry; "mate", "bro", "dude" = friend; "innit" = isn't it, right; "gonna/wanna" = going to/want to; "it's giving…" = it looks/feels like…
Turkish: "kanka", "kanki" = buddy; "abi", "abla" = bro, sis (also polite for an older person); "lan" = dude (rough, between friends); "valla" = honestly; "aynen" = exactly; "eyvallah" = thanks, cheers; "hadi ya", "yok artık" = no way; "kolay gelsin" = greeting to someone working; "eline sağlık" = thanks for the food, nice work; "geçmiş olsun" = sorry that happened, get well; "afiyet olsun" = enjoy your meal; "kafayı yemek" = to go crazy; "boş yapma" = stop talking nonsense; "efsane" = legendary; "çok fena" = awesome or awful, by context; "hocam" = coach, teacher, or a friendly respectful "mate" (by context, never left as "hocam"); "naber", "ne haber" = what's up; "iyiyim" = I'm good; "sağ ol", "saol" = thanks; "kusura bakma" = sorry; "boşver" = never mind; "tamam", "olur" = OK; "hı hı" = yeah; "yok" = no, there isn't; "hadi" = come on, let's go; "of ya" = ugh. Turkish has one word, "o", for he, she and it: in English use the person's name or "they" unless the conversation makes it clear. English "you" to Turkish: "sen" between friends, family and teammates, "siz" for strangers, elders or to show respect; follow the conversation's tone and stay consistent.
Russian: "блин" = damn; "короче" = anyway, long story short; "ну" = well; "давай" = come on, OK, bye; "чё" = what; "прикол" = funny thing, joke; "кайф" = bliss; "норм" = fine; "жесть", "капец" = insane, crazy; "забей" = forget it; "ваще" = totally.
Spanish: "tío/tía" (Spain), "güey/wey" (Mexico), "che" (Argentina), "pana" (Venezuela, Caribbean) = dude; "vale" = OK; "guay", "chévere", "padre", "bacán" = cool; "neta" = really; "ni modo" = oh well; "me vale" = I don't care.
Portuguese (Brazil): "cara", "mano" = dude; "beleza" = cool, OK; "valeu" = thanks; "né" = right?; "tipo" = like; "nossa" = wow; "tô de boa" = I'm chill; "saudade" = missing someone; "gambiarra" = makeshift fix.
Arabic: "yalla" = come on, let's go; "wallah" = I swear, really; "inshallah" = hopefully (often a polite maybe); "mashallah" = wonderful; "habibi/habibti" = dear, buddy; "khalas" = enough, done; "ya'ni" = I mean, like; "tamam" = OK; "mafi mushkila", "ma fi mushkila" = no problem; "shlonak", "ezayak" = how are you (Gulf, Egyptian).
Hindi and Urdu: "yaar" = buddy; "accha" = OK, really?; "arre" = hey, oh; "bas" = enough, that's it; "chalo" = OK, let's go; "theek hai" = OK; "pakka" = for sure; "jugaad" = clever hack; "bindaas" = carefree, cool; "timepass" = killing time; "kya scene hai" = what's up.
Bengali: "dada", "didi" = older brother, sister (also friendly address); "ki obostha" = what's up; "jhamela" = hassle; "adda" = long chat with friends; "bhalo" = good.
Indonesian: "gue/gw", "lo/lu" = I, you (casual); "anjir", "anjay" = damn, wow; "santai" = relax; "gokil" = crazy, awesome; "mager" = too lazy to move; "baper" = taking it personally; "otw" = on the way; "wkwk" = haha; the particles "sih", "dong", "deh", "kok" soften or stress and rarely need words of their own.
French: "wesh" = hey, yo; "frérot", "frère" = bro; "grave" = totally; "ouf" = crazy; "kiffer" = to love; "chelou" = weird; "relou" = annoying; "bof" = meh; "du coup" = so; "genre" = like; "c'est chaud" = it's intense, tough.
Chinese: "牛", "牛逼" = awesome; "绝了" = amazing; "666" = nice one; "yyds", "永远的神" = the greatest; "躺平" = giving up on the rat race; "内卷" = rat race; "靠谱" = reliable; "加油" = come on, you've got this; "没事" = no worries; "随便" = whatever.
Terms of address (yaar, abi, habibi, dada, güey, kanka, frérot) become the target language's own (mate, bro, dear), not the original word, unless the listener's language uses it too.
Sports talk (volleyball and others): keep the terms players of the target language really use; many are borrowed from English ("spike", "set", "libero", "timeout"), so use those rather than a literal translation.
</spoken_language_reference>`;

/**
 * Last line of defence for what reaches the screen: with thinking off, a model can occasionally
 * second-guess itself in the visible reply ("Wait, the target is English…"). Keep the final
 * subtitle line and drop anything that reads as a note to itself.
 */
export function subtitleOnly(text: string): string {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^(wait|note|actually|hmm|let me|i should|i need|translation\s*:|subtitle\s*:)/i.test(l));
  const line = lines.length > 1 ? lines[lines.length - 1] : (lines[0] ?? "");
  // A continuation sometimes opens with "..." — the screen shows it joined to what came before.
  let out = line.replace(/^(\.\.\.|…)\s*/u, "").trim();
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
  const src = langInfo(input.sourceLang).name;
  const tgt = langInfo(input.targetLang).name;
  const glossary = Object.entries(input.glossary);
  const context = input.context.map((c) => `${c.who} (${langInfo(c.lang).name}): ${c.text}`).join("\n");

  const user = [
    `<languages>${src} to ${tgt}</languages>`,
    glossary.length ? `<glossary>\n${glossary.map(([k, v]) => `${k} = ${v}`).join("\n")}\n</glossary>` : "",
    context ? `<recent_conversation>\n${context}\n</recent_conversation>` : "",
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
        output_config: { effort: "low" },
        system: [{ type: "text", text: SYSTEM }, { type: "text", text: SLANG, cache_control: { type: "ephemeral" } }],
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
- Translate meaning, not words. Idioms, slang and colloquialisms become the natural equivalent in the target language; keep the speaker's register and tone. Drop fillers and false starts that carry no meaning.
- If the phrase stops mid-sentence, stop there too; do not guess what comes next. In languages where the verb comes last (Turkish, Hindi, Urdu, Bengali, Japanese, Korean), a phrase often arrives before its verb: translate only what is there and never invent the missing verb; it comes with the next phrase, so place it naturally then. When the phrase is marked final, it is the end of what they said: finish the sentence naturally.
- You don't know anyone's gender. Never add one the source doesn't have: Turkish "o", Indonesian "dia" and similar become just "they" (or the person's name) in English, never "he/she".
- The transcript comes from speech recognition and can contain mistakes. Use what was said before and the recent conversation to work out what was meant, but translate only the new phrase.
- Where the target language marks gender, prefer phrasing that avoids committing to one, otherwise use the grammatical default.
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
  signal: AbortSignal;
};

/**
 * Steady captions: translate one finished phrase of a long utterance as a continuation of the
 * subtitle already shown, so text is only ever appended, never rewritten. Null on failure;
 * an empty string when the phrase needs no subtitle.
 */
export async function phraseTranslate(input: PhraseInput): Promise<string | null> {
  if (!refineConfigured()) return null;
  client ??= new Anthropic();
  const src = langInfo(input.sourceLang).name;
  const tgt = langInfo(input.targetLang).name;
  const context = input.context.map((c) => `${c.who} (${langInfo(c.lang).name}): ${c.text}`).join("\n");
  const user = [
    `<languages>${src} to ${tgt}</languages>`,
    context ? `<recent_conversation>\n${context}\n</recent_conversation>` : "",
    input.before ? `<said_so_far>${input.before}</said_so_far>` : "",
    input.shown ? `<subtitle_so_far>${input.shown}</subtitle_so_far>` : "",
    `<new_phrase final="${input.final}">${input.phrase}</new_phrase>`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const started = Date.now();
  try {
    const res = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 300,
        thinking: { type: "disabled" },
        output_config: { effort: "low" },
        system: [{ type: "text", text: PHRASE_SYSTEM }, { type: "text", text: SLANG, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: user }],
      },
      { signal: input.signal, maxRetries: 0 },
    );
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
