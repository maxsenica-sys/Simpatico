import { EventEmitter } from "node:events";
import WebSocket from "ws";
import { log } from "./log";
import type { SonioxContext } from "./vocab";

export type SonioxToken = {
  text: string;
  is_final: boolean;
  translation_status?: "original" | "translation" | "none";
  language?: string;
  source_language?: string;
  start_ms?: number;
  end_ms?: number;
  confidence?: number;
};

type SonioxResponse = {
  tokens?: SonioxToken[];
  finished?: boolean;
  error_code?: number;
  error_type?: string;
  error_message?: string;
};

export type SonioxStreamConfig = {
  /** Soniox base language code of the speaker. */
  source: string;
  /** Soniox base language code to translate into, or null to transcribe only. */
  target: string | null;
  /** Shows up in Soniox's dashboard and our logs. */
  ref: string;
  /** Names in the call and words to recognise (see vocab.ts). */
  context?: SonioxContext;
  /**
   * In person (one phone, two people): the languages that may be spoken, and per-word language
   * identification so each sentence can be given to the right side. Default: just `source`.
   */
  hints?: string[];
  identify?: boolean;
};

const URL = process.env.SONIOX_URL ?? "wss://stt-rt.soniox.com/transcribe-websocket";
const MODEL = process.env.SONIOX_MODEL ?? "stt-rt-v6";
const MAX_BUFFER_BYTES = 16000 * 2 * 5; // 5 s of audio while (re)connecting
const KEEPALIVE_MS = 8000;

export function sonioxConfigured(): boolean {
  return !!process.env.SONIOX_API_KEY;
}

/**
 * One upstream Soniox real-time session. Emits:
 *  - "ready" once the config has been sent
 *  - "tokens" (tokens: SonioxToken[]) for every response
 *  - "drop" ({ fatal: boolean, reason: string }) when the socket ends without us asking
 * Billing runs for as long as the socket is open, so callers must close() it promptly.
 */
export class SonioxStream extends EventEmitter {
  private ws: WebSocket | null = null;
  private open = false;
  private closed = false;
  private pending: Buffer[] = [];
  private pendingBytes = 0;
  private lastSent = 0;
  private keepalive: NodeJS.Timeout | null = null;
  private lastFinalize = 0;
  readonly startedAt = Date.now();

  constructor(readonly config: SonioxStreamConfig) {
    super();
  }

  start() {
    const key = process.env.SONIOX_API_KEY;
    if (!key) throw new Error("SONIOX_API_KEY not set");
    const ws = new WebSocket(URL, { headers: { Authorization: `Bearer ${key}` } });
    this.ws = ws;

    ws.on("open", () => {
      if (this.closed) return ws.close();
      const { source, target, ref } = this.config;
      ws.send(
        JSON.stringify({
          model: MODEL,
          audio_format: "pcm_s16le",
          sample_rate: 16000,
          num_channels: 1,
          // A call's stream carries one person's own mic, so the source language is known. In
          // person, two languages share one mic and each word is tagged with its language.
          language_hints: this.config.hints ?? [source],
          language_hints_strict: !this.config.identify,
          ...(this.config.identify ? { enable_language_identification: true } : {}),
          enable_endpoint_detection: true,
          max_endpoint_delay_ms: Number(process.env.SONIOX_MAX_ENDPOINT_MS ?? 1200),
          // Endpoints a little sooner (0-3, higher = sooner, slightly lower accuracy). v5/v6 models.
          endpoint_latency_adjustment_level: Number(process.env.SONIOX_ENDPOINT_LEVEL ?? 1),
          client_reference_id: ref,
          ...(this.config.context ? { context: this.config.context } : {}),
          ...(target ? { translation: { type: "one_way", target_language: target } } : {}),
        }),
      );
      this.open = true;
      for (const chunk of this.pending) ws.send(chunk);
      this.pending = [];
      this.pendingBytes = 0;
      this.lastSent = Date.now();
      this.keepalive = setInterval(() => {
        if (this.open && Date.now() - this.lastSent > KEEPALIVE_MS) {
          ws.send(JSON.stringify({ type: "keepalive" }));
          this.lastSent = Date.now();
        }
      }, 2000);
      log("soniox_open", { ref, source, target, model: MODEL });
      this.emit("ready");
    });

    ws.on("message", (data) => {
      let msg: SonioxResponse;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (msg.error_code) {
        const fatal = [400, 401, 402, 403].includes(msg.error_code);
        log("soniox_error", { ref: this.config.ref, code: msg.error_code, type: msg.error_type, message: msg.error_message });
        this.fail(fatal, `${msg.error_code} ${msg.error_type ?? ""} ${msg.error_message ?? ""}`.trim());
        return;
      }
      if (msg.tokens?.length) this.emit("tokens", msg.tokens);
    });

    ws.on("close", (code, reason) => this.fail(false, `closed ${code} ${reason.toString()}`.trim()));
    ws.on("error", (err) => this.fail(false, `error ${err.message}`));
  }

  sendAudio(chunk: Buffer) {
    if (this.closed) return;
    if (this.open && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(chunk);
      this.lastSent = Date.now();
      return;
    }
    this.pending.push(chunk);
    this.pendingBytes += chunk.length;
    while (this.pendingBytes > MAX_BUFFER_BYTES && this.pending.length) {
      this.pendingBytes -= this.pending.shift()!.length;
    }
  }

  /** Ask Soniox to finalize everything heard so far (returns a "<fin>" token). Rate-limited. */
  finalize(): boolean {
    if (!this.open || this.closed || Date.now() - this.lastFinalize < 1500) return false;
    this.lastFinalize = Date.now();
    this.ws?.send(JSON.stringify({ type: "finalize" }));
    return true;
  }

  /** Close immediately. No "drop" event. */
  close() {
    if (this.closed) return;
    this.closed = true;
    this.teardown();
    log("soniox_close", { ref: this.config.ref, seconds: Math.round((Date.now() - this.startedAt) / 1000) });
  }

  private fail(fatal: boolean, reason: string) {
    if (this.closed) return;
    this.closed = true;
    this.teardown();
    this.emit("drop", { fatal, reason });
  }

  private teardown() {
    this.open = false;
    if (this.keepalive) clearInterval(this.keepalive);
    this.keepalive = null;
    this.pending = [];
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.removeAllListeners();
      ws.on("error", () => {});
      try {
        ws.terminate();
      } catch {}
    }
  }
}
