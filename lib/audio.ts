"use client";

import { VAD, VoiceGate } from "./vad";

/** Caption audio: soft sentences are lifted towards this peak level, by at most this much. */
const CAPTION_TARGET_DB = -24;
const CAPTION_BOOST_MAX_DB = 12;

function boost(pcm: ArrayBuffer, gainDb: number): ArrayBuffer {
  const g = Math.pow(10, gainDb / 20);
  const src = new Int16Array(pcm);
  const out = new Int16Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(src[i] * g)));
  return out.buffer;
}

type Level = { floor: number };
function trackFloor(l: Level, db: number) {
  if (db < l.floor) l.floor = l.floor * 0.7 + db * 0.3;
  else l.floor = Math.min(l.floor + 0.05, db); // ~0.5 dB/s upward drift
}

/**
 * Feeds the SAME mic track that is in the RTCPeerConnection into an AudioWorklet
 * (never a second getUserMedia: iOS would fight over the device), gates it on local
 * voice activity, and hands 16 kHz PCM16 chunks to `onChunk` only while speaking.
 */
export class MicCapture {
  private ctx: AudioContext;
  private node: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private sink: GainNode | null = null;
  private remote: { analyser: AnalyserNode; sources: MediaStreamAudioSourceNode[]; buf: Float32Array<ArrayBuffer> } | null = null;
  private remoteLevel: Level = { floor: -60 };
  private preroll: { pcm: ArrayBuffer; db: number }[] = [];
  /** Who is speaking at this phone, decided per 100 ms chunk (lib/vad.ts). */
  private gate = new VoiceGate();
  enabled = true;
  /** Ignore voices much quieter than the person at this phone (people further away). */
  get focus() {
    return this.gate.focus;
  }
  set focus(on: boolean) {
    this.gate.focus = on;
  }

  constructor(
    private track: MediaStreamTrack,
    /** `db` = the chunk's level in dBFS (used server-side to tell who is nearest in a shared room). */
    private onChunk: (pcm: ArrayBuffer, db: number) => void,
    private onSpeech: (on: boolean) => void,
  ) {
    // Created inside the Join tap so iOS lets it run.
    this.ctx = new AudioContext({ latencyHint: "interactive" });
  }

  async start() {
    await this.ctx.audioWorklet.addModule("/pcm-worklet.js");
    this.source = this.ctx.createMediaStreamSource(new MediaStream([this.track]));
    this.node = new AudioWorkletNode(this.ctx, "pcm-capture", { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: "explicit" });
    this.sink = this.ctx.createGain();
    this.sink.gain.value = 0; // keep the node pulled by the graph without playing the mic back
    this.source.connect(this.node).connect(this.sink).connect(this.ctx.destination);
    this.node.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; db: number; zcr?: number }>) => this.onLevel(e.data.pcm, e.data.db, e.data.zcr ?? 0);
    await this.resume();
  }

  async resume() {
    if (this.ctx.state !== "running") await this.ctx.resume().catch(() => {});
  }

  /**
   * Watch the audio we play from the other people, so their voices leaking from our speaker
   * don't open the gate. Each track gets its own source (a stream source only reads one track).
   */
  setRemote(tracks: MediaStreamTrack[]) {
    for (const s of this.remote?.sources ?? []) s.disconnect();
    this.remote = null;
    if (!tracks.length) return;
    try {
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 2048;
      const sources = tracks.map((t) => {
        const s = this.ctx.createMediaStreamSource(new MediaStream([t]));
        s.connect(analyser);
        return s;
      });
      this.remote = { sources, analyser, buf: new Float32Array(analyser.fftSize) };
    } catch {
      // Some browsers can't tap a remote WebRTC stream; the gate still works without it.
    }
  }

  private remoteTalking(): boolean {
    if (!this.remote) return false;
    this.remote.analyser.getFloatTimeDomainData(this.remote.buf);
    let e = 0;
    for (const s of this.remote.buf) e += s * s;
    const db = 10 * Math.log10(e / this.remote.buf.length + 1e-12);
    trackFloor(this.remoteLevel, db);
    return db > -50 && db > this.remoteLevel.floor + 10;
  }

  /** Loudest chunk of the sentence being sent: sets the caption-audio boost for soft speakers. */
  private sentencePeak = -120;

  private onLevel(pcm: ArrayBuffer, db: number, zcr: number) {
    if (!this.enabled) db = -120;
    const ev = this.gate.push(db, zcr, this.remoteTalking(), Date.now());
    if (ev === null) {
      // Not speaking: keep the last second, so a soft beginning isn't lost.
      this.preroll.push({ pcm, db });
      if (this.preroll.length > VAD.PREROLL_CHUNKS) this.preroll.shift();
      return;
    }
    if (ev === "start") {
      this.sentencePeak = Math.max(db, ...this.preroll.map((c) => c.db));
      this.onSpeech(true);
      for (const c of this.preroll) this.send(c.pcm, c.db);
      this.preroll = [];
    }
    this.sentencePeak = Math.max(this.sentencePeak, db);
    this.send(pcm, db);
    if (ev === "stop") this.onSpeech(false);
  }

  /**
   * Whispered or soft sentences reach speech recognition very quietly: lift them (up to +12 dB,
   * by the sentence's loudest part so the level doesn't pump). Only the copy sent for captions;
   * the other person hears the real voice. `db` stays the original level (used to tell who is
   * nearest in a shared room).
   */
  private send(pcm: ArrayBuffer, db: number) {
    const gainDb = Math.min(CAPTION_BOOST_MAX_DB, Math.max(0, CAPTION_TARGET_DB - this.sentencePeak));
    this.onChunk(gainDb > 0.5 ? boost(pcm, gainDb) : pcm, db);
  }

  stop() {
    this.node?.port.close();
    this.node?.disconnect();
    this.source?.disconnect();
    for (const s of this.remote?.sources ?? []) s.disconnect();
    this.ctx.close().catch(() => {});
  }
}
