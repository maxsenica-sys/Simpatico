/**
 * Mic audio for captions, held on the phone while the connection is slow or briefly gone, then
 * sent in order once it recovers, so nothing said is lost to a bad connection: the words just
 * arrive a little late. The "stopped speaking" marks go through the same queue, so the server
 * never closes a sentence before its last words have arrived.
 *
 * Long pauses are shortened while audio is waiting (a little silence is kept: it is how the
 * transcriber hears where a sentence ends), and at most MAX_MS is held (a very long outage keeps
 * its most recent speech).
 */
const FRAME_MS = 100;
const MAX_MS = 45_000;
const KEEP_QUIET_FRAMES = 6;
/** What the socket may hold unsent before we wait (about 2 s of audio). */
const SOCKET_LIMIT = 64_000;
/** Below this level (dBFS) a frame counts as silence. */
const QUIET_DB = -55;

export class AudioOutbox {
  private q: (Uint8Array | string)[] = [];
  private quiet = 0;

  /** Queue one frame (byte 0 = level, then PCM) and send whatever the socket can take. */
  audio(ws: WebSocket | null, frame: Uint8Array, db: number, canSend: boolean) {
    if (db < QUIET_DB) {
      this.quiet++;
      if (this.q.length && this.quiet > KEEP_QUIET_FRAMES) return this.flush(ws, canSend);
    } else this.quiet = 0;
    this.q.push(frame);
    let frames = 0;
    for (const x of this.q) if (typeof x !== "string") frames++;
    while (frames > MAX_MS / FRAME_MS) {
      const dropped = this.q.shift();
      if (typeof dropped !== "string") frames--;
    }
    this.flush(ws, canSend);
  }

  /** A control message that must stay in order with the audio (speech on/off). */
  mark(ws: WebSocket | null, msg: string, canSend: boolean) {
    this.q.push(msg);
    this.flush(ws, canSend);
  }

  /** Send, oldest first, as much as the socket takes without piling up. */
  flush(ws: WebSocket | null, canSend = true) {
    if (!canSend || !ws || ws.readyState !== WebSocket.OPEN) return;
    while (this.q.length && ws.bufferedAmount < SOCKET_LIMIT) ws.send(this.q.shift()!);
  }

  /** Seconds of speech waiting to go out. */
  get behindMs() {
    return this.q.filter((x) => typeof x !== "string").length * FRAME_MS;
  }

  clear() {
    this.q = [];
    this.quiet = 0;
  }
}
