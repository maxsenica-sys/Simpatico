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
- You don't know the speaker's or listener's gender. Where the target language marks gender (verb endings, adjectives, pronouns), prefer natural phrasing that avoids committing to one; if that isn't possible, use the grammatical default.
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
Turkish: "kanka", "kanki" = buddy; "abi", "abla" = bro, sis (also polite for an older person); "lan" = dude (rough, between friends); "valla" = honestly; "aynen" = exactly; "eyvallah" = thanks, cheers; "hadi ya", "yok artık" = no way; "kolay gelsin" = greeting to someone working; "eline sağlık" = thanks for the food, nice work; "geçmiş olsun" = sorry that happened, get well; "afiyet olsun" = enjoy your meal; "kafayı yemek" = to go crazy; "boş yapma" = stop talking nonsense; "efsane" = legendary; "çok fena" = awesome or awful, by context.
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
  return (lines.length > 1 ? lines[lines.length - 1] : (lines[0] ?? "")).trim();
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
    log("refine_ok", { ms: Date.now() - started, src: input.sourceLang, tgt: input.targetLang, cached: res.usage.cache_read_input_tokens ?? 0 });
    return text || null;
  } catch (err) {
    const aborted = input.signal.aborted;
    log(aborted ? "refine_late" : "refine_error", { ms: Date.now() - started, error: aborted ? undefined : String(err) });
    return null;
  }
}

const INTERIM_SYSTEM = `You write live subtitles for a video call between two people who don't share a language. The speaker is still talking. You get the newest stretch of their speech, transcribed as it is spoken, and you translate just that stretch so the listener can follow along before the sentence is finished.

- Translate only the fragment you are given. It may stop mid-sentence: do not complete it, guess what comes next, or add final punctuation.
- Use the earlier part of the same sentence only to understand the fragment; do not translate it again.
- Natural spoken wording, same register and tone. Idioms and slang by meaning, not word for word.
- Your whole reply appears on screen as the subtitle: the translation only, in the target language and its usual script.`;

export type InterimInput = {
  /** The newest untranslated stretch of the utterance. */
  fragment: string;
  /** What the speaker said earlier in the same utterance (already captioned). */
  before: string;
  sourceLang: string;
  targetLang: string;
  signal: AbortSignal;
};

/**
 * A quick translation of the untranslated tail of a long utterance that is still being spoken,
 * so the reader isn't left waiting for the speaker to pause. Null on any failure.
 */
export async function interimTranslate(input: InterimInput): Promise<string | null> {
  if (!refineConfigured()) return null;
  client ??= new Anthropic();
  const src = langInfo(input.sourceLang).name;
  const tgt = langInfo(input.targetLang).name;
  const user = [
    `<languages>${src} to ${tgt}</languages>`,
    input.before ? `<earlier_in_sentence>${input.before}</earlier_in_sentence>` : "",
    `<fragment>${input.fragment}</fragment>`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const started = Date.now();
  try {
    const res = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 200,
        thinking: { type: "disabled" },
        output_config: { effort: "low" },
        system: [{ type: "text", text: INTERIM_SYSTEM }, { type: "text", text: SLANG, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: user }],
      },
      { signal: input.signal, maxRetries: 0 },
    );
    if (res.stop_reason === "refusal") return null;
    const raw = res.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("");
    const text = subtitleOnly(raw);
    log("interim_ok", { ms: Date.now() - started, chars: input.fragment.length, cached: res.usage.cache_read_input_tokens ?? 0 });
    return text || null;
  } catch (err) {
    if (!input.signal.aborted) log("interim_error", { ms: Date.now() - started, error: String(err) });
    return null;
  }
}
