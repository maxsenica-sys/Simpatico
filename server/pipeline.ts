import { baseLang, sameLanguage } from "../shared/lang";
import type { CaptionStage, CaptionState, SpeakerProfile } from "../shared/protocol";
import { log } from "./log";
import { phraseTranslate, refine, refineConfigured, type ContextLine, type People } from "./refine";
import { SonioxStream, sonioxConfigured, type SonioxToken } from "./soniox";
import { sonioxContext } from "./vocab";
import { isTrivialEdit } from "./text";

/**
 * Hard deadline for pass 2, measured from the moment the utterance is finalised.
 * The brief started at 1500 ms; real calls showed Claude Haiku at 0.75–1.5 s, so 1500 dropped
 * ~40% of rewrites. 2000 keeps nearly all of them while still landing before the reader moves on.
 */
export const REFINE_DEADLINE_MS = 2000;
/** Translation tokens trail the source tokens; stop attributing them to a closed utterance after this. */
const SEAL_QUIET_MS = 700;
const SEAL_MAX_MS = 2500;
/**
 * Close the upstream socket after this long without speech; Soniox bills for as long as it is open.
 * 10 s keeps it open through normal back-and-forth; reopening costs ~0.3 s at the start of the next
 * utterance, and no audio is lost (it is buffered while the socket connects).
 */
const IDLE_CLOSE_MS = 10_000;
const tuned = (key: string, fallback: number) => {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
/**
 * Steady captions (the default reading style): a long utterance is subtitled phrase by phrase from
 * Soniox's finalised words, each phrase translated once and appended, never rewritten. A phrase is
 * ready at a clause boundary with enough words, at a length cap, or when the speaker pauses briefly.
 */
const STEADY_MIN_WORDS = tuned("STEADY_MIN_WORDS", 4);
const STEADY_MAX_WORDS = tuned("STEADY_MAX_WORDS", 8);
const STEADY_PAUSE_MS = tuned("STEADY_PAUSE_MS", 700);
const STEADY_TIMEOUT_MS = 3000;
/** Live readers' faint preview of the words not yet in a phrase. */
const PREVIEW_MIN_WORDS = tuned("PREVIEW_MIN_WORDS", 2);
const PREVIEW_EVERY_MS = tuned("PREVIEW_EVERY_MS", 350);
const PREVIEW_PARALLEL = tuned("PREVIEW_PARALLEL", 2);
const PREVIEW_SEND_MS = 90;
const PREVIEW_TIMEOUT_MS = 2500;
const VERB_FINAL = new Set(["tr", "hi", "ur", "bn", "ja", "ko", "fa", "ta", "te", "mr", "kn", "ml", "gu", "pa", "az", "kk", "uz", "mn", "my", "ne", "si"]);
/** Short joining words a phrase shouldn't end on (the main Latin-script app languages). */
const JOINING = /^(and|or|but|so|when|if|that|which|who|where|while|because|the|a|an|of|to|in|on|at|for|with|from|by|as|than|then|ve|ama|ile|için|gibi|de|da|ki|и|а|но|что|когда|в|на|с|y|o|pero|que|cuando|el|la|los|las|de|en|con|para|e|ou|mas|quando|o|os|as|do|da|em|com|et|ou|mais|quand|le|les|du|des|dans|avec|pour|dan|atau|tapi|yang|di|ke|dari|untuk)$/i;
const CLAUSE_END = /[.!?;:,…。！？，、；：؟،।]["'”’)\]]*\s*$/u;
const BACKOFF_MS = [0, 250, 1000, 2000, 5000];

/**
 * Which readers a caption is for: "instant" (word by word, may be revised), "steady" (phrase by
 * phrase, append-only), or "all" when there is only one version.
 */
export type CaptionStyleTag = "instant" | "steady" | "all";

/** What a pipeline says to the people reading this speaker; the room adds who it is from. */
export type ReaderMsg =
  | { t: "caption"; id: string; stage: CaptionStage; text: string; tail?: string; style?: CaptionStyleTag; cover?: number }
  | { t: "captions"; state: CaptionState; side: "theirs" };
export type SpeakerMsg =
  | { t: "own"; id: string; text: string; final: boolean }
  | { t: "captions"; state: CaptionState; side: "mine" };

export interface PipelineHost {
  /** Room-unique label for logs and Soniox. */
  ref: string;
  /** How this speaker is labelled in LLM context ("A", "B", …). */
  label: string;
  /** The readers of this pipeline's target language. */
  toReader(msg: ReaderMsg): void;
  toSpeaker(msg: SpeakerMsg): void;
  /**
   * Readers who read the speaker's own language (group calls): they get the original words.
   * Only set on the speaker's primary translating pipeline, so they get them once.
   */
  toOriginal?(msg: ReaderMsg): void;
  /** Last utterances of the conversation, both sides, oldest first. */
  context(): ContextLine[];
  record(line: ContextLine): void;
  glossary(): Record<string, string>;
  /** Seconds an upstream stream was open (Soniox bills by open time), reported when it closes. */
  billed?(seconds: number): void;
  /**
   * A caption line settled: what was said and how it was translated. The room keeps the latest
   * ones in memory only, so a reader can report a bad translation (see rooms.ts).
   */
  settled?(id: string, source: string, translation: string): void;
  /** First names of everyone in the call, so the translator can recognise a misheard name. */
  callNames?(): string[];
  speakerName?(): string;
  /** Names of the people in the call, so speech recognition spells them right. */
  names?(): string[];
  /** The speaker's optional profile: where they're from, their words and usual topics. */
  profile?(): SpeakerProfile;
  /** Optional genders of the speaker and (when there is exactly one) the reader, for grammar. */
  people?(): People;
  /** Reading styles wanted by this pipeline's readers right now. Both when not given. */
  styles?(): { steady: boolean; instant: boolean };
}

type Utterance = {
  id: string;
  origFinal: string;
  origLive: string;
  trFinal: string;
  trLive: string;
  state: "open" | "closing" | "done";
  /** No more translation tokens will be attributed to it. */
  sealed: boolean;
  refineDone: boolean;
  refined: string | null;
  sealTimer?: NodeJS.Timeout;
  sealMax?: NodeJS.Timeout;
  lastReaderText?: string;
  lastOwnText?: string;
  lastOrigText?: string;
  /** Live readers: a quick translation of the words after the shown phrases (faint, may change). */
  previewText: string;
  previewSource: string;
  previewInFlight: number;
  previewAt: number;
  previewSeq: number;
  previewShownSeq: number;
  previewSentAt: number;
  previewSendTimer?: NodeJS.Timeout;
  previewTimer?: NodeJS.Timeout;
  previewCover: number;
  /** Steady captions: words of the utterance already translated and shown. */
  steadyWords: number;
  /** Steady captions: the subtitle shown so far for this utterance (only ever appended to). */
  steadyText: string;
  steadyBusy: boolean;
  steadyDone: boolean;
  steadyFails: number;
  steadyTimer?: NodeJS.Timeout;
};

const END_TOKENS = new Set(["<end>", "<fin>"]);
const SENTENCE_END = /[.!?。！？…؟।]["'”’)\]]*\s*$/u;

/**
 * Captions for one speaker's microphone, delivered to the other participant.
 * Pass 1 forwards Soniox tokens as they arrive; pass 2 swaps in an idiomatic LLM rewrite
 * when an utterance ends, subject to the anti-flicker rules.
 */
export class SpeakerPipeline {
  private speaks: string | null = null;
  private reads: string | null = null;
  private stream: SonioxStream | null = null;
  private failures = 0;
  private fatalUntil = 0;
  private idleTimer: NodeJS.Timeout | null = null;
  private seq = 0;
  /** Makes utterance ids unique across re-seats, so a rejoin never overwrites old transcript lines. */
  private readonly epoch = Date.now().toString(36);
  private open: Utterance | null = null;
  /** Closed utterances whose translation may still be streaming in, oldest first. */
  private closing: Utterance[] = [];

  constructor(private host: PipelineHost) {}

  /** Configure from the speaker's `speaks` and the reader's `reads`. Null reader means nobody to caption for. */
  setLanguages(speaks: string, reads: string | null) {
    const changed = !this.speaks || !this.reads || !reads || baseLang(speaks) !== baseLang(this.speaks) || baseLang(reads) !== baseLang(this.reads);
    this.speaks = speaks;
    this.reads = reads;
    if (changed) this.stopStream("reconfigure");
  }

  private get translating() {
    return !!this.speaks && !!this.reads && !sameLanguage(this.speaks, this.reads);
  }

  audio(chunk: Buffer) {
    if (!this.speaks || !this.reads) return; // nobody listening: never open a billable stream
    if (!sonioxConfigured()) return;
    if (Date.now() < this.fatalUntil) return;
    if (!this.stream) this.startStream();
    this.stream!.sendAudio(chunk);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.stopStream("idle"), IDLE_CLOSE_MS);
  }

  /** Client-side voice activity ended (after its hangover): finalize instead of waiting for the endpoint. */
  speechEnded() {
    if (this.open && (this.open.origFinal || this.open.origLive)) this.stream?.finalize();
  }

  /** Participant gone, or reader gone. Closes upstream immediately. */
  stop() {
    this.stopStream("stop");
    this.speaks = this.reads = null;
  }

  private startStream() {
    const source = baseLang(this.speaks)!;
    const target = this.translating ? baseLang(this.reads)! : null;
    const stream = new SonioxStream({ source, target, ref: this.host.ref, context: sonioxContext(source, this.host.names?.() ?? []) });
    this.stream = stream;
    stream.on("ready", () => this.status("ok"));
    stream.on("tokens", (tokens: SonioxToken[]) => {
      this.failures = 0;
      this.onTokens(tokens);
    });
    stream.on("drop", ({ fatal, reason }: { fatal: boolean; reason: string }) => {
      if (this.stream !== stream) return;
      this.stream = null;
      this.host.billed?.((Date.now() - stream.startedAt) / 1000);
      this.flushOpen();
      log("soniox_drop", { ref: this.host.ref, fatal, reason, failures: this.failures });
      if (fatal) {
        // Bad key / out of credit: stop hammering, tell the reader captions are unavailable.
        this.fatalUntil = Date.now() + 60_000;
        this.status("unavailable");
      } else {
        // Video is unaffected; captions resume on the next audio chunk.
        this.failures++;
        this.status("paused");
      }
    });
    const delay = BACKOFF_MS[Math.min(this.failures, BACKOFF_MS.length - 1)];
    if (delay) setTimeout(() => this.stream === stream && stream.start(), delay);
    else stream.start();
  }

  /** Both people see caption health: the reader for "theirs", the speaker for "mine". */
  private status(state: "ok" | "paused" | "unavailable") {
    this.host.toReader({ t: "captions", state, side: "theirs" });
    this.host.toSpeaker({ t: "captions", state, side: "mine" });
  }

  private stopStream(why: string) {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (this.stream) {
      log("soniox_stop", { ref: this.host.ref, why });
      this.host.billed?.((Date.now() - this.stream.startedAt) / 1000);
      this.stream.close();
      this.stream = null;
    }
    this.flushOpen();
  }

  // ---------------------------------------------------------------- tokens

  private newUtterance(): Utterance {
    return {
      id: `${this.host.ref}-${this.epoch}-${++this.seq}`,
      origFinal: "",
      origLive: "",
      trFinal: "",
      trLive: "",
      state: "open",
      sealed: false,
      refineDone: false,
      refined: null,
      previewText: "",
      previewSource: "",
      previewInFlight: 0,
      previewAt: 0,
      previewSeq: 0,
      previewShownSeq: 0,
      previewSentAt: 0,
      previewCover: 0,
      steadyWords: 0,
      steadyText: "",
      steadyBusy: false,
      steadyDone: false,
      steadyFails: 0,
    };
  }

  /** Where translation tokens go: the oldest closed utterance still accepting them, else the open one. */
  private translationTarget(): Utterance {
    const c = this.closing.find((u) => !u.sealed);
    if (c) return c;
    return (this.open ??= this.newUtterance());
  }

  private onTokens(tokens: SonioxToken[]) {
    // Non-final tokens are re-sent in full with every response.
    if (this.open) this.open.origLive = "";
    for (const u of this.closing) u.trLive = "";
    if (this.open) this.open.trLive = "";
    const touched = new Set<Utterance>();

    for (const tok of tokens) {
      const isTr = tok.translation_status === "translation";
      if (END_TOKENS.has(tok.text)) {
        if (!isTr && tok.is_final && this.open) {
          touched.add(this.open);
          this.closeOpen();
        }
        continue;
      }
      if (!isTr) {
        const u = (this.open ??= this.newUtterance());
        if (tok.is_final) u.origFinal += tok.text;
        else u.origLive += tok.text;
        touched.add(u);
      } else {
        const u = this.translationTarget();
        if (tok.is_final) u.trFinal += tok.text;
        else u.trLive += tok.text;
        touched.add(u);
        if (u.state === "closing") this.armSeal(u);
      }
    }
    for (const u of touched) this.emit(u);
    if (this.open) {
      this.maybeSteady(this.open);
      this.maybePreview(this.open);
    }
  }

  private get wants() {
    return this.host.styles?.() ?? { steady: true, instant: true };
  }

  /**
   * Settled phrases (both reading styles) need the LLM; without it everyone gets the one
   * Soniox-only version. Live readers get the same phrases plus a faint preview.
   */
  private get steadyOn() {
    const w = this.wants;
    return this.translating && (w.steady || w.instant) && refineConfigured();
  }

  private get instantTag(): CaptionStyleTag {
    return this.steadyOn ? "instant" : "all";
  }

  // ------------------------------------------------------- steady captions

  /**
   * The utterance as words (characters for scripts written without spaces), and how many of them
   * are settled: everything except the last couple of words Soniox is still recognising.
   * Waiting for Soniox to mark words final costs 5+ s on continuous speech; its earlier words
   * almost never change once a couple more have been heard.
   */
  /** Verb-final languages: wait longer for a clause boundary, so a phrase usually includes its verb. */
  private get phraseScale() {
    return VERB_FINAL.has(baseLang(this.speaks) ?? "") ? 1.5 : 1;
  }

  private steadyUnits(u: Utterance) {
    const full = u.origFinal + u.origLive;
    const spaced = /\s/.test(full.trim()) || !/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0e00-\u0e7f]/u.test(full);
    const units = spaced ? full.trim().split(/\s+/).filter(Boolean) : Array.from(full.replace(/\s+/g, ""));
    const guard = u.origLive.trim() ? (spaced ? 2 : 3) : /\s$/.test(full) || CLAUSE_END.test(full) ? 0 : 1;
    return { units, sep: spaced ? " " : "", stable: Math.max(0, units.length - guard), scale: spaced ? 1 : 2 };
  }

  /** While they speak: send the next finished phrase for translation when one is ready. */
  private maybeSteady(u: Utterance) {
    if (!this.steadyOn || u.state !== "open" || u.steadyBusy || u.steadyDone) return;
    if (u.steadyTimer) clearTimeout(u.steadyTimer);
    const { units, stable, scale } = this.steadyUnits(u);
    const pending = units.slice(u.steadyWords, stable);
    // End the phrase at the last clause boundary (comma, full stop…) once it has enough words.
    for (let i = pending.length - 1; i + 1 >= STEADY_MIN_WORDS * scale; i--) {
      if (CLAUSE_END.test(pending[i])) return this.steadyPhrase(u, false, i + 1);
    }
    if (pending.length >= Math.round(STEADY_MAX_WORDS * scale * this.phraseScale)) {
      // Don't end a phrase on a joining word ("when", "and", "the"): it belongs with what follows.
      let n = pending.length;
      while (n > STEADY_MIN_WORDS * scale && n > pending.length - 3 && JOINING.test(pending[n - 1])) n--;
      return this.steadyPhrase(u, false, n);
    }
    // A short pause mid-sentence also ends a phrase, so the reader isn't kept waiting.
    if (units.length - u.steadyWords >= STEADY_MIN_WORDS * scale) {
      u.steadyTimer = setTimeout(() => this.open === u && !u.steadyBusy && this.steadyPhrase(u, false), STEADY_PAUSE_MS);
    }
  }

  /** Translate the next `count` words (default: everything not yet shown) and append them. */
  private steadyPhrase(u: Utterance, final: boolean, count?: number) {
    const { units, sep } = this.steadyUnits(u);
    const n = final || count === undefined ? units.length - u.steadyWords : count;
    const phrase = units.slice(u.steadyWords, u.steadyWords + Math.max(0, n)).join(sep).trim();
    if (!phrase) return final ? this.steadyEmit(u, true) : undefined;
    u.steadyBusy = true;
    const upTo = u.steadyWords + n;
    phraseTranslate({
      phrase,
      before: units.slice(0, u.steadyWords).join(sep).trim(),
      shown: u.steadyText,
      final,
      sourceLang: this.speaks!,
      targetLang: this.reads!,
      context: this.host.context(),
      people: this.host.people?.(),
      profile: this.host.profile?.(),
      callNames: this.host.callNames?.(),
      speakerName: this.host.speakerName?.(),
      signal: AbortSignal.timeout(STEADY_TIMEOUT_MS),
    }).then((text) => {
      u.steadyBusy = false;
      if (u.steadyDone) return;
      // An empty reply for a real phrase (3+ words) is a miss, not "nothing to say": retry it.
      if (text === "" && phrase.split(/\s+/).length >= 3) text = null;
      if (text === null) {
        // Words are never skipped: they go out again with the next phrase. Only a sentence
        // whose closing phrase keeps failing is settled on what is already shown.
        if (++u.steadyFails >= 3 && u.state !== "open") return this.steadyEmit(u, true);
      } else {
        u.steadyFails = 0;
        u.steadyWords = upTo;
        if (text) u.steadyText = joinText(u.steadyText, text);
        this.steadyEmit(u, false);
      }
      if (u.state === "open") this.maybeSteady(u);
      else this.steadyClose(u);
    });
  }

  /** The utterance ended: translate what's left as the closing phrase, or use the full rewrite. */
  private steadyClose(u: Utterance) {
    if (!this.steadyOn || u.steadyDone || u.steadyBusy) return;
    if (u.steadyTimer) clearTimeout(u.steadyTimer);
    if (!u.steadyText && u.steadyWords === 0) {
      // Short utterance, nothing shown yet: the idiomatic rewrite of the whole thing is the subtitle.
      if (!u.refineDone) return; // called again when it lands
      const text = u.refined ?? (u.sealed ? this.literal(u) : null);
      if (text === null) return; // called again from seal()
      u.steadyText = text.trim();
      return this.steadyEmit(u, true);
    }
    if (this.steadyUnits(u).units.length > u.steadyWords) return this.steadyPhrase(u, true);
    this.steadyEmit(u, true);
  }

  private steadyEmit(u: Utterance, final: boolean) {
    if (final) {
      u.steadyDone = true;
      if (u.steadyText) this.host.settled?.(`${u.id}~s`, (u.origFinal + u.origLive).trim(), u.steadyText);
    }
    // The preview covered words that are now settled: drop it (the next one follows within a second).
    u.previewText = "";
    u.previewSource = "";
    const wants = this.wants;
    if (wants.steady && (u.steadyText || final)) {
      this.host.toReader({ t: "caption", id: `${u.id}~s`, stage: final ? "final" : "steady", text: u.steadyText, style: "steady" });
    }
    if (wants.instant) this.sendLive(u, final);
    if (!final && u.state === "open") this.maybePreview(u);
  }

  private literal(u: Utterance): string {
    if (!this.translating) return (u.origFinal + u.origLive).trim();
    return (u.trFinal + u.trLive).trim();
  }

  /**
   * Live readers: a quick translation of the words after the last shown phrase, drawn faintly
   * after the settled text so the reader isn't waiting for the phrase to finish. It is replaced
   * as they keep talking and disappears when the phrase lands, so only the faint end ever moves.
   */
  private maybePreview(u: Utterance) {
    if (!this.steadyOn || !this.wants.instant || u.state !== "open" || u.steadyDone) return;
    if (u.previewInFlight >= PREVIEW_PARALLEL) return; // picked up again when one lands
    const now = Date.now();
    const wait = u.previewAt + PREVIEW_EVERY_MS - now;
    if (wait > 0) {
      // Check again then, even if no new words arrive meanwhile (the speaker paused).
      u.previewTimer ??= setTimeout(() => {
        u.previewTimer = undefined;
        this.maybePreview(u);
      }, wait);
      return;
    }
    const { units, sep, scale } = this.steadyUnits(u);
    const from = u.steadyWords;
    const tail = units.slice(from);
    if (tail.length < PREVIEW_MIN_WORDS * scale) return;
    const fragment = tail.join(sep);
    if (fragment === u.previewSource) return;
    // Previews overlap: a new one starts every PREVIEW_EVERY_MS while earlier ones are still being
    // written. Each is numbered; a reply only shows if nothing newer has shown and no phrase
    // has settled meanwhile. Replies stream in, so the first words show before the reply is done.
    const seq = ++u.previewSeq;
    u.previewInFlight++;
    u.previewAt = now;
    u.previewSource = fragment;
    const show = (text: string) => {
      if (u.state !== "open" || u.steadyDone || u.steadyWords !== from || seq < u.previewShownSeq) return;
      if (!text || text === u.previewText) return;
      u.previewShownSeq = seq;
      u.previewText = text;
      u.previewCover = from + tail.length;
      // Partial replies arrive a few characters at a time: send at most every PREVIEW_SEND_MS.
      const since = Date.now() - u.previewSentAt;
      if (since >= PREVIEW_SEND_MS) {
        u.previewSentAt = Date.now();
        this.sendLive(u, false);
      } else {
        u.previewSendTimer ??= setTimeout(() => {
          u.previewSendTimer = undefined;
          u.previewSentAt = Date.now();
          if (u.state === "open" && !u.steadyDone) this.sendLive(u, false);
        }, PREVIEW_SEND_MS - since);
      }
    };
    // Same continuation prompt as the settled phrases: it sees the subtitle already shown, so the
    // preview carries on from it instead of re-translating it.
    phraseTranslate({
      phrase: fragment,
      before: units.slice(0, from).join(sep),
      shown: u.steadyText,
      final: false,
      sourceLang: this.speaks!,
      targetLang: this.reads!,
      context: this.host.context(),
      people: this.host.people?.(),
      profile: this.host.profile?.(),
      callNames: this.host.callNames?.(),
      speakerName: this.host.speakerName?.(),
      signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS),
      onPartial: show,
    }).then((text) => {
      u.previewInFlight--;
      if (text) show(text);
      // A phrase landed meanwhile: preview what's left, right away.
      if (u.steadyWords !== from) u.previewAt = 0;
      this.maybePreview(u);
    });
  }

  /** The Live version of a line: settled phrases plus the faint preview. */
  private sendLive(u: Utterance, final: boolean) {
    if (!u.steadyText && !u.previewText && !final) return;
    this.host.toReader({
      t: "caption",
      id: `${u.id}~s`,
      stage: final ? "final" : "steady",
      text: u.steadyText,
      tail: final ? undefined : u.previewText || undefined,
      style: "instant",
      // How many source words this line covers (for latency measurement; not sent to phones).
      cover: u.previewText && !final ? u.previewCover : u.steadyWords,
    });
  }

  private emit(u: Utterance) {
    const own = (u.origFinal + u.origLive).trim();
    if (own && own !== u.lastOwnText) {
      u.lastOwnText = own;
      this.host.toSpeaker({ t: "own", id: u.id, text: own, final: u.state !== "open" });
    }
    if (this.translating && this.host.toOriginal && own && own !== u.lastOrigText && u.state === "open") {
      u.lastOrigText = own;
      this.host.toOriginal({ t: "caption", id: `${u.id}-src`, stage: "live", text: own });
    }
    if (u.state === "done" || this.steadyOn) return;
    const text = this.literal(u);
    if (text && text !== u.lastReaderText) {
      u.lastReaderText = text;
      this.host.toReader({ t: "caption", id: u.id, stage: "live", text, style: this.instantTag });
    }
  }

  // ------------------------------------------------------------ utterances

  private closeOpen() {
    const u = this.open;
    this.open = null;
    if (!u) return;
    u.origFinal += u.origLive;
    u.origLive = "";
    const source = u.origFinal.trim();
    if (!source) {
      u.state = "done";
      if (u.lastReaderText) this.host.toReader({ t: "caption", id: u.id, stage: "final", text: "", style: this.instantTag });
      if (u.steadyText || u.previewText) this.steadyEmit(u, true);
      return;
    }
    const context = this.host.context();
    this.host.record({ who: this.host.label, lang: this.speaks!, text: source });
    // Always mark the speaker's own line final, even when its text didn't change at close.
    this.host.toSpeaker({ t: "own", id: u.id, text: source, final: true });
    u.lastOwnText = source;
    if (this.translating && this.host.toOriginal) this.host.toOriginal({ t: "caption", id: `${u.id}-src`, stage: "final", text: source });

    if (!this.translating) {
      u.state = "done";
      this.host.toReader({ t: "caption", id: u.id, stage: "final", text: source, style: "all" });
      return;
    }

    u.state = "closing";
    this.closing.push(u);
    this.armSeal(u);
    u.sealMax = setTimeout(() => this.seal(u), SEAL_MAX_MS);
    this.steadyClose(u);

    // The whole-utterance rewrite serves word-by-word readers, and steady readers when the
    // utterance was short enough that no phrase was shown yet.
    const steadyNeedsRewrite = u.steadyWords === 0 && !u.steadyBusy;
    if (this.steadyOn && !steadyNeedsRewrite) {
      u.refineDone = true;
      return;
    }

    const abort = new AbortController();
    const deadline = setTimeout(() => abort.abort(), REFINE_DEADLINE_MS);
    const closedAt = Date.now();
    refine({
      source,
      sourceLang: this.speaks!,
      targetLang: this.reads!,
      speaker: this.host.label,
      context,
      glossary: this.host.glossary(),
      people: this.host.people?.(),
      profile: this.host.profile?.(),
      callNames: this.host.callNames?.(),
      speakerName: this.host.speakerName?.(),
      signal: abort.signal,
    }).then((refined) => {
      clearTimeout(deadline);
      // A late result is discarded: a caption that mutates after the reader moved on is worse.
      if (Date.now() - closedAt > REFINE_DEADLINE_MS) refined = null;
      u.refineDone = true;
      u.refined = refined;
      this.steadyClose(u);
      if (u.state === "done") return;
      if (refined && !isTrivialEdit(this.literal(u), refined)) {
        this.finish(u, "refined", refined);
      } else {
        this.maybeFinish(u);
      }
    });
  }

  private armSeal(u: Utterance) {
    if (u.sealTimer) clearTimeout(u.sealTimer);
    // A translated sentence ending in punctuation with nothing pending is complete.
    const done = !u.trLive && SENTENCE_END.test(u.trFinal);
    u.sealTimer = setTimeout(() => this.seal(u), done ? 150 : SEAL_QUIET_MS);
  }

  private seal(u: Utterance) {
    if (u.sealed) return;
    u.sealed = true;
    u.trFinal += u.trLive;
    u.trLive = "";
    if (u.sealTimer) clearTimeout(u.sealTimer);
    if (u.sealMax) clearTimeout(u.sealMax);
    this.closing = this.closing.filter((x) => x !== u);
    this.maybeFinish(u);
    this.steadyClose(u);
  }

  private maybeFinish(u: Utterance) {
    if (u.state !== "done" && u.refineDone && u.sealed) this.finish(u, "final", this.literal(u));
  }

  private finish(u: Utterance, stage: "final" | "refined", text: string) {
    u.state = "done";
    if (this.steadyOn) return; // steady / live readers get their own version
    this.host.toReader({ t: "caption", id: u.id, stage, text: text.trim(), style: this.instantTag });
    this.host.settled?.(u.id, u.origFinal.trim(), text.trim());
    // Keep it attached until sealed so trailing translation tokens are not misattributed to the next one.
  }

  /** The stream is going away mid-utterance: settle whatever we have. */
  private flushOpen() {
    if (this.open) this.closeOpen();
    for (const u of [...this.closing]) {
      if (!u.refineDone) u.refineDone = true; // the in-flight refine may still land, and is honoured by finish()
      this.seal(u);
    }
  }
}

function joinText(a: string, b: string): string {
  if (!a) return b.trim();
  const sep = /[\u3000-\u9fff\uff00-\uffef]$/u.test(a) ? "" : " ";
  return `${a.trimEnd()}${sep}${b.trim()}`;
}
