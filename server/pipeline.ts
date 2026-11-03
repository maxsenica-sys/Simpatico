import { baseLang, sameLanguage } from "../shared/lang";
import type { ServerMsg } from "../shared/protocol";
import { log } from "./log";
import { refine, type ContextLine } from "./refine";
import { SonioxStream, sonioxConfigured, type SonioxToken } from "./soniox";
import { isTrivialEdit } from "./text";

/** Hard deadline for pass 2, measured from the moment the utterance is finalised. */
export const REFINE_DEADLINE_MS = 1500;
/** Translation tokens trail the source tokens; stop attributing them to a closed utterance after this. */
const SEAL_QUIET_MS = 700;
const SEAL_MAX_MS = 2500;
/** Close the upstream socket after this long without speech; it bills for as long as it is open. */
const IDLE_CLOSE_MS = 45_000;
const BACKOFF_MS = [0, 250, 1000, 2000, 5000];

export interface PipelineHost {
  /** Room-unique label for logs and Soniox. */
  ref: string;
  /** "A" or "B": how this speaker is labelled in LLM context. */
  label: "A" | "B";
  toReader(msg: ServerMsg): void;
  toSpeaker(msg: ServerMsg): void;
  /** Last utterances of the conversation, both sides, oldest first. */
  context(): ContextLine[];
  record(line: ContextLine): void;
  glossary(): Record<string, string>;
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
    const stream = new SonioxStream({ source, target, ref: this.host.ref });
    this.stream = stream;
    stream.on("ready", () => this.host.toReader({ t: "captions", state: "ok" }));
    stream.on("tokens", (tokens: SonioxToken[]) => {
      this.failures = 0;
      this.onTokens(tokens);
    });
    stream.on("drop", ({ fatal, reason }: { fatal: boolean; reason: string }) => {
      if (this.stream !== stream) return;
      this.stream = null;
      this.flushOpen();
      log("soniox_drop", { ref: this.host.ref, fatal, reason, failures: this.failures });
      if (fatal) {
        // Bad key / out of credit: stop hammering, tell the reader captions are unavailable.
        this.fatalUntil = Date.now() + 60_000;
        this.host.toReader({ t: "captions", state: "unavailable" });
      } else {
        // Video is unaffected; captions resume on the next audio chunk.
        this.failures++;
        this.host.toReader({ t: "captions", state: "paused" });
      }
    });
    const delay = BACKOFF_MS[Math.min(this.failures, BACKOFF_MS.length - 1)];
    if (delay) setTimeout(() => this.stream === stream && stream.start(), delay);
    else stream.start();
  }

  private stopStream(why: string) {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (this.stream) {
      log("soniox_stop", { ref: this.host.ref, why });
      this.stream.close();
      this.stream = null;
    }
    this.flushOpen();
  }

  // ---------------------------------------------------------------- tokens

  private newUtterance(): Utterance {
    return {
      id: `${this.host.ref}-${++this.seq}`,
      origFinal: "",
      origLive: "",
      trFinal: "",
      trLive: "",
      state: "open",
      sealed: false,
      refineDone: false,
      refined: null,
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
  }

  private literal(u: Utterance): string {
    return (this.translating ? u.trFinal + u.trLive : u.origFinal + u.origLive).trim();
  }

  private emit(u: Utterance) {
    const own = (u.origFinal + u.origLive).trim();
    if (own && own !== u.lastOwnText) {
      u.lastOwnText = own;
      this.host.toSpeaker({ t: "own", id: u.id, text: own, final: u.state !== "open" });
    }
    if (u.state === "done") return;
    const text = this.literal(u);
    if (text && text !== u.lastReaderText) {
      u.lastReaderText = text;
      this.host.toReader({ t: "caption", id: u.id, stage: "live", text });
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
      if (u.lastReaderText) this.host.toReader({ t: "caption", id: u.id, stage: "final", text: "" });
      return;
    }
    const context = this.host.context();
    this.host.record({ who: this.host.label, lang: this.speaks!, text: source });
    if (u.lastOwnText !== source) this.host.toSpeaker({ t: "own", id: u.id, text: source, final: true });
    u.lastOwnText = source;

    if (!this.translating) {
      u.state = "done";
      this.host.toReader({ t: "caption", id: u.id, stage: "final", text: source });
      return;
    }

    u.state = "closing";
    this.closing.push(u);
    this.armSeal(u);
    u.sealMax = setTimeout(() => this.seal(u), SEAL_MAX_MS);

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
      signal: abort.signal,
    }).then((refined) => {
      clearTimeout(deadline);
      // A late result is discarded: a caption that mutates after the reader moved on is worse.
      if (Date.now() - closedAt > REFINE_DEADLINE_MS) refined = null;
      u.refineDone = true;
      u.refined = refined;
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
  }

  private maybeFinish(u: Utterance) {
    if (u.state !== "done" && u.refineDone && u.sealed) this.finish(u, "final", this.literal(u));
  }

  private finish(u: Utterance, stage: "final" | "refined", text: string) {
    u.state = "done";
    this.host.toReader({ t: "caption", id: u.id, stage, text: text.trim() });
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
