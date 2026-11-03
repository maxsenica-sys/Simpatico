"use client";

/** Tunables for the local voice-activity gate. Levels are dBFS of 100 ms chunks. */
const MIN_THRESHOLD_DB = -52;
const ABOVE_FLOOR_DB = 12;
/** Extra margin while the other person is audibly talking, so leaked speaker output isn't transcribed as ours. */
const DOUBLE_TALK_PENALTY_DB = 10;
const OPEN_CHUNKS = 2; // 200 ms above threshold to open
const HANGOVER_CHUNKS = 9; // 900 ms below threshold to close
const PREROLL_CHUNKS = 3;

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
  private remote: { analyser: AnalyserNode; source: MediaStreamAudioSourceNode; buf: Float32Array<ArrayBuffer> } | null = null;
  private local: Level = { floor: -60 };
  private remoteLevel: Level = { floor: -60 };
  private preroll: ArrayBuffer[] = [];
  private above = 0;
  private below = 0;
  private speaking = false;
  enabled = true;

  constructor(
    private track: MediaStreamTrack,
    private onChunk: (pcm: ArrayBuffer) => void,
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
    this.node.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; db: number }>) => this.onLevel(e.data.pcm, e.data.db);
    await this.resume();
  }

  async resume() {
    if (this.ctx.state !== "running") await this.ctx.resume().catch(() => {});
  }

  /** Watch the other side's audio so their voice leaking from our speaker doesn't open the gate. */
  setRemote(stream: MediaStream | null) {
    this.remote?.source.disconnect();
    this.remote = null;
    if (!stream || !stream.getAudioTracks().length) return;
    try {
      const source = this.ctx.createMediaStreamSource(stream);
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      this.remote = { source, analyser, buf: new Float32Array(analyser.fftSize) };
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

  private onLevel(pcm: ArrayBuffer, db: number) {
    if (!this.enabled) db = -120;
    trackFloor(this.local, db);
    const threshold = Math.max(MIN_THRESHOLD_DB, this.local.floor + ABOVE_FLOOR_DB) + (this.remoteTalking() ? DOUBLE_TALK_PENALTY_DB : 0);
    const voiced = db > threshold;

    if (!this.speaking) {
      this.preroll.push(pcm);
      if (this.preroll.length > PREROLL_CHUNKS) this.preroll.shift();
      this.above = voiced ? this.above + 1 : 0;
      if (this.above >= OPEN_CHUNKS) {
        this.speaking = true;
        this.below = 0;
        this.onSpeech(true);
        for (const c of this.preroll) this.onChunk(c);
        this.preroll = [];
      }
      return;
    }

    this.onChunk(pcm);
    this.below = voiced ? 0 : this.below + 1;
    if (this.below >= HANGOVER_CHUNKS) {
      this.speaking = false;
      this.above = 0;
      this.onSpeech(false);
    }
  }

  stop() {
    this.node?.port.close();
    this.node?.disconnect();
    this.source?.disconnect();
    this.remote?.source.disconnect();
    this.ctx.close().catch(() => {});
  }
}
