"use client";

/** Tunables for the local voice-activity gate. Levels are dBFS of 100 ms chunks. */
const MIN_THRESHOLD_DB = -52;
/** To START sending: this far above the room's noise floor (clearly a voice). */
const ABOVE_FLOOR_DB = 12;
/**
 * To KEEP sending once someone is talking: much lower (hysteresis), so whispers, soft or
 * deep voices, yawned words and quiet sentence endings stay in the sentence instead of
 * being cut off as silence.
 */
const STAY_ABOVE_FLOOR_DB = 6;
const STAY_MIN_THRESHOLD_DB = -58;
/** A soft word this soon after speech ended continues it (reopens on the lower threshold). */
const RESUME_MS = 1500;
/** Extra margin while the other person is audibly talking, so leaked speaker output isn't transcribed as ours. */
const DOUBLE_TALK_PENALTY_DB = 10;
const OPEN_CHUNKS = 2; // 2 of the last 3 chunks (100 ms each) voiced to open: soft onsets flicker
const HANGOVER_CHUNKS = 7; // 700 ms below threshold to close (Soniox wants >= 200 ms)
const PREROLL_CHUNKS = 5; // 500 ms kept from before the gate opened, so a soft first syllable isn't lost
/**
 * Voice focus: speech much quieter than this phone's own talker is someone further away.
 * A voice at ~0.5 m is roughly 12-20 dB louder than one 2-4 m away, so speech more than
 * FOCUS_MARGIN_DB below the usual level of the voice we caption is not sent for captions.
 * Learnt from the last few seconds of admitted speech, so a louder (closer) voice always passes.
 */
const FOCUS_MARGIN_DB = 18;
const FOCUS_HISTORY = 80; // 8 s of speech
const FOCUS_MIN_HISTORY = 15; // 1.5 s before it starts filtering

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
  private local: Level = { floor: -60 };
  private remoteLevel: Level = { floor: -60 };
  private preroll: { pcm: ArrayBuffer; db: number }[] = [];
  private recent: boolean[] = [];
  private endedAt = 0;
  private below = 0;
  private speaking = false;
  /** Recent levels of the speech we captioned (the person holding this phone). */
  private near: number[] = [];
  enabled = true;
  /** Ignore voices much quieter than the person at this phone (people further away). */
  focus = true;

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
    this.node.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; db: number }>) => this.onLevel(e.data.pcm, e.data.db);
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

  private onLevel(pcm: ArrayBuffer, db: number) {
    if (!this.enabled) db = -120;
    trackFloor(this.local, db);
    const penalty = this.remoteTalking() ? DOUBLE_TALK_PENALTY_DB : 0;
    const start = Math.max(MIN_THRESHOLD_DB, this.local.floor + ABOVE_FLOOR_DB) + penalty;
    const stay = Math.max(STAY_MIN_THRESHOLD_DB, this.local.floor + STAY_ABOVE_FLOOR_DB) + penalty;

    if (!this.speaking) {
      this.preroll.push({ pcm, db });
      if (this.preroll.length > PREROLL_CHUNKS) this.preroll.shift();
      // Just after they spoke: a soft word continues the sentence. Otherwise it must be clearly a
      // voice, and (voice focus) not much quieter than this phone's own talker.
      const resumed = Date.now() - this.endedAt < RESUME_MS;
      const voiced = resumed ? db > stay : db > start && (!this.focus || db >= this.nearLevel() - FOCUS_MARGIN_DB);
      this.recent.push(voiced);
      if (this.recent.length > 3) this.recent.shift();
      if ((resumed && voiced) || this.recent.filter(Boolean).length >= OPEN_CHUNKS) {
        this.speaking = true;
        this.below = 0;
        this.recent = [];
        this.onSpeech(true);
        for (const c of this.preroll) this.onChunk(c.pcm, c.db);
        this.preroll = [];
      }
      return;
    }

    // Talking: everything above the low "stay" level counts, so quiet words aren't cut out.
    // Voice focus only decides whether speech starts, never removes words mid-sentence.
    this.onChunk(pcm, db);
    if (db > start) {
      this.near.push(db); // the talker's clear speech sets their usual level
      if (this.near.length > FOCUS_HISTORY) this.near.shift();
    }
    this.below = db > stay ? 0 : this.below + 1;
    if (this.below >= HANGOVER_CHUNKS) {
      this.speaking = false;
      this.endedAt = Date.now();
      this.onSpeech(false);
    }
  }

  /** Typical level of this phone's talker: the 70th percentile of recent captioned speech. */
  private nearLevel(): number {
    if (this.near.length < FOCUS_MIN_HISTORY) return -Infinity;
    const sorted = [...this.near].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.7)];
  }

  stop() {
    this.node?.port.close();
    this.node?.disconnect();
    this.source?.disconnect();
    for (const s of this.remote?.sources ?? []) s.disconnect();
    this.ctx.close().catch(() => {});
  }
}
