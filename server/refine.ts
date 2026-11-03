import Anthropic from "@anthropic-ai/sdk";
import { langInfo } from "../shared/lang";
import { log } from "./log";

export type ContextLine = { who: "A" | "B"; lang: string; text: string };

export type RefineInput = {
  /** Finalised source-language transcript of the utterance (not the machine translation). */
  source: string;
  sourceLang: string;
  targetLang: string;
  /** Which participant is speaking, matching the labels used in `context`. */
  speaker: "A" | "B";
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
- Reply with the translation only: no quotes, notes, alternatives, transliteration or explanations. If the utterance has no translatable content, reply with it unchanged.`;

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
        system: SYSTEM,
        messages: [{ role: "user", content: user }],
      },
      { signal: input.signal, maxRetries: 0 },
    );
    if (res.stop_reason === "refusal") {
      log("refine_refused", { ms: Date.now() - started });
      return null;
    }
    const text = res.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("")
      .trim();
    log("refine_ok", { ms: Date.now() - started, src: input.sourceLang, tgt: input.targetLang });
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
- Reply with the translation only.`;

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
        system: INTERIM_SYSTEM,
        messages: [{ role: "user", content: user }],
      },
      { signal: input.signal, maxRetries: 0 },
    );
    if (res.stop_reason === "refusal") return null;
    const text = res.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("")
      .trim();
    log("interim_ok", { ms: Date.now() - started, chars: input.fragment.length });
    return text || null;
  } catch (err) {
    if (!input.signal.aborted) log("interim_error", { ms: Date.now() - started, error: String(err) });
    return null;
  }
}
