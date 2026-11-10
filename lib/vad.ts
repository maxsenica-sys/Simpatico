/**
 * Decides, every 100 ms chunk, whether the person at this phone is speaking, so only their
 * speech is sent for captions. Pure logic (no audio APIs) so it can be tested with recorded
 * level patterns: see test/vad.test.ts.
 *
 * Inputs per chunk: level (dBFS), zero-crossing rate (0..1: breathy/whispered sound is high,
 * voiced sound low) and whether the other person's voice is playing right now.
 *
 * Starting to speak needs one of:
 *  - a clear voice: well above the room's noise and not much quieter than this phone's own
 *    talker (voice focus: people further away are quieter);
 *  - a soft voice in reply: just after (or over) the other person, e.g. a quiet
 *    "I love you too", which is almost always the person holding the phone;
 *  - a whisper: soft but breathy (high zero-crossing rate), which a voice across the room
 *    isn't (distance strips the hiss);
 *  - a soft word right after they stopped (continuing the sentence).
 * Once speaking, anything above the low "stay" level counts, so soft or deep words, yawns
 * and trailing endings stay in the sentence.
 */
export const VAD = {
  MIN_THRESHOLD_DB: -52,
  ABOVE_FLOOR_DB: 12,
  STAY_ABOVE_FLOOR_DB: 6,
  STAY_MIN_THRESHOLD_DB: -58,
  /** While their voice is playing: our own echo-cancelled leak stays below this extra margin. */
  DOUBLE_TALK_PENALTY_DB: 6,
  RESUME_MS: 1500,
  /** A soft voice this soon after the other person stopped is taken as a reply. */
  REPLY_WINDOW_MS: 2500,
  /**
   * Whisper: breathy for WHISPER_CHUNKS in a row. Measured on real recorded speech, ordinary
   * voiced speech has a median zero-crossing rate of 0.06 and only ever passes 0.2 for one or
   * two chunks (an "s"); 4 in a row never happened, so a distant voice can't pass as a whisper.
   */
  WHISPER_ZCR: 0.2,
  WHISPER_CHUNKS: 4,
  OPEN_OF_3: 2,
  HANGOVER_CHUNKS: 7,
  /** Audio kept from before speech was detected (1 s), so a soft beginning is never cut off. */
  PREROLL_CHUNKS: 10,
  FOCUS_MARGIN_DB: 18,
  FOCUS_HISTORY: 80,
  FOCUS_MIN_HISTORY: 15,
};

export type GateEvent = "start" | "chunk" | "stop" | null;

export class VoiceGate {
  floor = -60;
  speaking = false;
  focus = true;
  private recent: boolean[] = [];
  private breathy = 0;
  private below = 0;
  private endedAt = -Infinity;
  private remoteEndedAt = -Infinity;
  private remoteWas = false;
  private near: number[] = [];

  /** Feed one 100 ms chunk. "start": begin sending (with pre-roll); "chunk": send; "stop": end. */
  push(db: number, zcr: number, remoteTalking: boolean, now: number): GateEvent {
    // Noise floor: falls fast, rises slowly (~0.5 dB/s).
    if (db < this.floor) this.floor = this.floor * 0.7 + db * 0.3;
    else this.floor = Math.min(this.floor + 0.05, db);
    if (this.remoteWas && !remoteTalking) this.remoteEndedAt = now;
    this.remoteWas = remoteTalking;

    const penalty = remoteTalking ? VAD.DOUBLE_TALK_PENALTY_DB : 0;
    const start = Math.max(VAD.MIN_THRESHOLD_DB, this.floor + VAD.ABOVE_FLOOR_DB) + penalty;
    const stay = Math.max(VAD.STAY_MIN_THRESHOLD_DB, this.floor + VAD.STAY_ABOVE_FLOOR_DB);

    if (!this.speaking) {
      const clear = db > start && (!this.focus || db >= this.nearLevel() - VAD.FOCUS_MARGIN_DB);
      const reply = remoteTalking ? db > stay + penalty : now - this.remoteEndedAt < VAD.REPLY_WINDOW_MS && db > stay;
      this.breathy = zcr >= VAD.WHISPER_ZCR && db > stay ? this.breathy + 1 : 0;
      const whisper = this.breathy >= VAD.WHISPER_CHUNKS;
      const resumed = now - this.endedAt < VAD.RESUME_MS && db > stay;
      const voiced = clear || reply || whisper || resumed;
      this.recent.push(voiced);
      if (this.recent.length > 3) this.recent.shift();
      if (resumed || whisper || this.recent.filter(Boolean).length >= VAD.OPEN_OF_3) {
        this.speaking = true;
        this.breathy = 0;
        this.below = 0;
        this.recent = [];
        return "start";
      }
      return null;
    }

    if (db > start) {
      this.near.push(db); // their clear speech sets their usual level (for voice focus)
      if (this.near.length > VAD.FOCUS_HISTORY) this.near.shift();
    }
    this.below = db > stay ? 0 : this.below + 1;
    if (this.below >= VAD.HANGOVER_CHUNKS) {
      this.speaking = false;
      this.endedAt = now;
      return "stop";
    }
    return "chunk";
  }

  /** Typical level of this phone's talker: the 70th percentile of recent clear speech. */
  nearLevel(): number {
    if (this.near.length < VAD.FOCUS_MIN_HISTORY) return -Infinity;
    const sorted = [...this.near].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.7)];
  }
}
