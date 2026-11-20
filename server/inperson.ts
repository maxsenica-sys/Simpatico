import type { WebSocket } from "ws";
import { baseLang, langInfo } from "../shared/lang";
import type { InPersonClientMsg, InPersonServerMsg } from "../shared/protocol";
import { log } from "./log";
import { SpeakerPipeline, type ReaderMsg, type SpeakerMsg } from "./pipeline";
import type { ContextLine } from "./refine";
import { SonioxStream, sonioxConfigured, type SonioxToken } from "./soniox";
import { append } from "./store";
import { sonioxContext } from "./vocab";

/** Close the stream after this long without speech (Soniox bills while it's open). */
const IDLE_CLOSE_MS = 15_000;
/** "Let them talk first": their language is settled once they've said this many words in it. */
const DETECT_WORDS = 3;
const END_TOKENS = new Set(["<end>", "<fin>"]);

/**
 * In person: one phone between two people. One Soniox stream hears both of them, with each word
 * tagged with its language; words in my language go to the "me" pipeline (translated for them),
 * words in theirs to the "them" pipeline (translated for me). Same caption pipelines as calls,
 * fed from the shared stream. Nothing is stored; one summary line when it ends.
 */
export class InPersonSession {
  private mine = "";
  private theirs: string | null = null;
  private stream: SonioxStream | null = null;
  private idle: NodeJS.Timeout | null = null;
  private history: ContextLine[] = [];
  private me: SpeakerPipeline;
  private them: SpeakerPipeline;
  /** Before their language is known: their finished words, kept until it is (then replayed). */
  private pending: SonioxToken[] = [];
  private startedAt = 0;
  private streamSeconds = 0;
  private words: string[] = [];
  private names: string[] = [];

  constructor(private ws: WebSocket, private device: string) {
    const host = (side: "me" | "them") => ({
      ref: `inperson-${side}`,
      label: side === "me" ? "A" : "B",
      toReader: (m: ReaderMsg) => {
        if (m.t !== "caption") return this.send({ t: "status", state: m.state });
        // My words in their language go on their half; theirs in mine on my half.
        if (!this.theirs) return;
        this.send({ t: "cap", for: side === "me" ? "them" : "me", id: m.id, stage: m.stage, text: m.text, tail: m.tail });
      },
      toSpeaker: (m: SpeakerMsg) => {
        if (m.t === "own") this.send({ t: "own", by: side, id: m.id, text: m.text, final: m.final });
      },
      context: () => this.history.slice(-6),
      record: (line: ContextLine) => {
        this.history.push(line);
        if (this.history.length > 50) this.history.splice(0, this.history.length - 50);
      },
      glossary: () => ({}),
      callNames: () => this.names,
      callWords: () => this.words,
      names: () => [...this.names, ...this.words],
      // Live reading: settled phrases plus the faint preview, as fast as it gets.
      styles: () => ({ steady: false, instant: true }),
    });
    this.me = new SpeakerPipeline(host("me"));
    this.them = new SpeakerPipeline(host("them"));
  }

  private send(msg: InPersonServerMsg) {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(msg));
  }

  message(msg: InPersonClientMsg) {
    if (msg.t === "start") {
      const mine = typeof msg.mine === "string" && baseLang(msg.mine) ? msg.mine : null;
      if (!mine) return this.send({ t: "error", code: "bad-request" });
      if (!sonioxConfigured()) return this.send({ t: "error", code: "unavailable" });
      this.mine = mine;
      this.names = Array.isArray(msg.names) ? msg.names.filter((x) => typeof x === "string").slice(0, 4).map((x) => x.slice(0, 40)) : [];
      this.words = Array.isArray(msg.words) ? msg.words.filter((x) => typeof x === "string").slice(0, 30).map((x) => x.slice(0, 40)) : [];
      this.startedAt ||= Date.now();
      this.setTheirs(typeof msg.theirs === "string" && baseLang(msg.theirs) && baseLang(msg.theirs) !== baseLang(mine) ? msg.theirs : null, false);
      log("inperson_start", { mine: baseLang(mine), theirs: baseLang(this.theirs), device: this.device });
      this.send({ t: "ready" });
      // Be listening before the first word: connecting only when someone talks delays it.
      if (!this.stream) {
        this.open();
        this.idle = setTimeout(() => this.stop("idle"), IDLE_CLOSE_MS);
      }
    } else if (msg.t === "theirs") {
      const t = typeof msg.lang === "string" && baseLang(msg.lang) && baseLang(msg.lang) !== baseLang(this.mine) ? msg.lang : null;
      if (t) {
        this.setTheirs(t, true);
        this.relisten("theirs");
      }
    } else if (msg.t === "mine") {
      const m = typeof msg.lang === "string" && baseLang(msg.lang) && baseLang(msg.lang) !== baseLang(this.theirs) ? msg.lang : null;
      if (m) {
        this.mine = m;
        this.setTheirs(this.theirs, false);
        this.relisten("mine");
      }
    } else if (msg.t === "speech") {
      if (!msg.on) this.stream?.finalize();
    } else if (msg.t === "end") {
      this.close("ended");
    }
  }

  /**
   * A language was changed by hand: listen for the new pair from the next word (the stream was
   * opened for the old pair, and would keep mishearing the new language until it went quiet).
   */
  private relisten(why: string) {
    if (this.stream) this.stop(`language:${why}`);
    this.pending = [];
  }

  private setTheirs(lang: string | null, tell: boolean) {
    this.theirs = lang;
    this.me.setLanguages(this.mine, lang);
    this.them.setLanguages(lang ?? this.mine, lang ? this.mine : null);
    if (lang && tell) this.send({ t: "lang", theirs: lang });
  }

  audio(chunk: Buffer) {
    if (!this.mine || !sonioxConfigured()) return;
    if (!this.stream) this.open();
    this.stream!.sendAudio(chunk);
    if (this.idle) clearTimeout(this.idle);
    this.idle = setTimeout(() => this.stop("idle"), IDLE_CLOSE_MS);
  }

  private open() {
    const source = baseLang(this.mine)!;
    const theirs = baseLang(this.theirs);
    const stream = new SonioxStream({
      source,
      target: null,
      ref: "inperson",
      hints: theirs ? [source, theirs] : [source],
      identify: true,
      context: sonioxContext(source, [...this.names, ...this.words]),
    });
    this.stream = stream;
    stream.on("ready", () => this.send({ t: "status", state: "ok" }));
    stream.on("tokens", (tokens: SonioxToken[]) => this.route(tokens));
    stream.on("drop", ({ fatal }: { fatal: boolean }) => {
      if (this.stream !== stream) return;
      this.streamSeconds += (Date.now() - stream.startedAt) / 1000;
      this.stream = null;
      this.me.flush();
      this.them.flush();
      this.send({ t: "status", state: fatal ? "unavailable" : "paused" });
    });
    stream.start();
  }

  /** Each word to the side whose language it is in. */
  private route(tokens: SonioxToken[]) {
    const mine = baseLang(this.mine);
    const forMe: SonioxToken[] = [];
    const forThem: SonioxToken[] = [];
    const unsure: SonioxToken[] = [];
    for (const tok of tokens) {
      if (tok.translation_status === "translation") continue;
      if (END_TOKENS.has(tok.text)) {
        forMe.push(tok);
        forThem.push(tok);
        continue;
      }
      const lang = baseLang(tok.language ?? "") ?? mine;
      if (lang === mine) forMe.push(tok);
      else if (this.theirs) forThem.push(tok);
      else unsure.push(tok);
    }
    if (!this.theirs && unsure.length) forThem.unshift(...this.detect(unsure));
    // Both every time: each response re-sends the words still being recognised, so a side with
    // none this time must drop the ones it showed last time.
    this.me.feed(forMe);
    this.them.feed(forThem);
  }

  /**
   * "Let them talk first": settle their language from their first few words, counting words as
   * they are heard (not only once confirmed), so it shows up while they're still talking. Returns
   * their words so far, to be captioned straight away.
   */
  private detect(unsure: SonioxToken[]): SonioxToken[] {
    for (const t of unsure) if (t.is_final) this.pending.push(t);
    if (this.pending.length > 80) this.pending.splice(0, this.pending.length - 80);
    const live = unsure.filter((t) => !t.is_final);
    const langs = new Set([...this.pending, ...live].map((t) => baseLang(t.language ?? "")).filter((l): l is NonNullable<typeof l> => !!l));
    for (const lang of langs) {
      const heard = [...this.pending, ...live].filter((t) => baseLang(t.language ?? "") === lang);
      const text = heard.map((t) => t.text).join("");
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      const cjk = /[぀-ヿ㐀-鿿가-힯]/.test(text);
      if (words < DETECT_WORDS && !(cjk && heard.length >= DETECT_WORDS)) continue;
      const full = langInfo(lang).code;
      log("inperson_detected", { lang: full });
      this.setTheirs(full, true);
      this.pending = [];
      return heard;
    }
    return [];
  }

  private stop(why: string) {
    if (this.idle) clearTimeout(this.idle);
    this.idle = null;
    if (this.stream) {
      this.streamSeconds += (Date.now() - this.stream.startedAt) / 1000;
      this.stream.close();
      this.stream = null;
      log("inperson_stream_stop", { why });
    }
    this.me.flush();
    this.them.flush();
  }

  close(why: string) {
    this.stop(why);
    this.me.stop();
    this.them.stop();
    if (this.startedAt) {
      const minutes = (Date.now() - this.startedAt) / 60000;
      append("calls", {
        room: "in-person",
        kind: "inperson",
        minutes: Math.round(minutes * 10) / 10,
        people: 2,
        langs: [baseLang(this.mine), baseLang(this.theirs)].filter(Boolean),
        devices: [this.device],
        captionMinutes: Math.round((this.streamSeconds / 60) * 10) / 10,
        estCostUsd: Math.round((this.streamSeconds / 3600) * 0.12 * 1000) / 1000,
      });
      this.startedAt = 0;
    }
  }
}
