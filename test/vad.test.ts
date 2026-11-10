// The speech gate against realistic 100 ms level patterns (speech syllables vary ±9 dB).
// Run: npx tsx test/vad.test.ts
import assert from "node:assert/strict";
import { VAD, VoiceGate } from "../lib/vad";

const SYLLABLES = [0, -4, -2, -7, -1, -9, -3, -5];
type Chunk = { db: number; zcr: number; remote: boolean; mine: boolean };
const silence = (s: number, floor = -62, remote = false): Chunk[] =>
  Array.from({ length: s * 10 }, (_, i) => ({ db: floor + (i % 3) - 1, zcr: 0.4, remote, mine: false }));
const speech = (s: number, base: number, o: { zcr?: number; remote?: boolean; mine?: boolean } = {}): Chunk[] =>
  Array.from({ length: Math.round(s * 10) }, (_, i) => ({ db: base + SYLLABLES[i % SYLLABLES.length], zcr: o.zcr ?? 0.08, remote: !!o.remote, mine: o.mine ?? true }));

/** Runs a scenario; returns the share of "mine" chunks that were sent (including pre-roll). */
function run(chunks: Chunk[], focus = true) {
  const g = new VoiceGate();
  g.focus = focus;
  const sent = new Set<number>();
  const preroll: number[] = [];
  let starts = 0;
  chunks.forEach((c, i) => {
    const ev = g.push(c.db, c.zcr, c.remote, i * 100);
    if (ev === null) {
      preroll.push(i);
      if (preroll.length > VAD.PREROLL_CHUNKS) preroll.shift();
      return;
    }
    if (ev === "start") {
      starts++;
      preroll.splice(0).forEach((j) => sent.add(j));
    }
    sent.add(i);
  });
  return { starts, sent, covered: (from: number, to: number) => { let n = 0, m = 0; for (let i = from; i < to; i++) if (chunks[i].mine) { m++; if (sent.has(i)) n++; } return m ? n / m : 1; } };
}
const at = (parts: Chunk[][]) => { const out: Chunk[] = []; const idx: number[] = []; for (const p of parts) { idx.push(out.length); out.push(...p); } idx.push(out.length); return { chunks: out, idx }; };

// The phone's talker speaks normally first (sets their usual level), then each case follows.
const calibrate = () => [silence(2), speech(4, -24), silence(4)];

{ // 1. Normal speech is sent in full.
  const { chunks, idx } = at([silence(2), speech(3, -24)]);
  const r = run(chunks);
  assert.ok(r.covered(idx[1], idx[2]) >= 0.97, `normal speech covered ${r.covered(idx[1], idx[2])}`);
  console.log("✓ normal speech: sent in full");
}
{ // 2. "I love you" (them) … soft "I love you too" (20+ dB quieter) just after.
  const { chunks, idx } = at([...calibrate(), silence(2, -62, true), silence(0.3), speech(1.2, -46)]);
  const r = run(chunks);
  const c = r.covered(idx[5], idx[6]);
  assert.ok(c >= 0.9, `soft reply covered ${c}`);
  console.log(`✓ soft reply right after the other person: ${Math.round(c * 100)}% of it sent`);
}
{ // 3. Soft reply overlapping the end of their sentence.
  const { chunks, idx } = at([...calibrate(), silence(1.5, -62, true), speech(1, -44, { remote: true })]);
  const r = run(chunks);
  assert.ok(r.covered(idx[4], idx[5]) >= 0.8, `overlapping soft reply covered ${r.covered(idx[4], idx[5])}`);
  console.log("✓ soft reply over the other person's last words: sent");
}
{ // 4. Whisper, long after anyone spoke.
  const { chunks, idx } = at([...calibrate(), silence(8), speech(2, -48, { zcr: 0.35 })]);
  const r = run(chunks);
  assert.ok(r.covered(idx[4], idx[5]) >= 0.85, `whisper covered ${r.covered(idx[4], idx[5])}`);
  console.log("✓ whisper: sent");
}
{ // 5. Soft beginning that gets louder ("I… love you").
  const { chunks, idx } = at([...calibrate(), silence(8), speech(0.6, -44), speech(1.5, -25)]);
  const r = run(chunks);
  assert.ok(r.covered(idx[4], idx[5]) >= 0.8, `soft beginning covered ${r.covered(idx[4], idx[5])}`);
  console.log("✓ soft beginning before a normal voice: kept");
}
{ // 6. A voice across the room (quiet, not breathy, nobody just spoke): not captioned.
  const { chunks } = at([...calibrate(), silence(8), speech(3, -47, { mine: false })]);
  const r = run(chunks);
  assert.equal(r.starts, 1, "only the talker's own speech starts the gate");
  console.log("✓ distant voice: not sent");
}
{ // 7. The other person's voice leaking from our speaker (echo-cancelled residue): not captioned.
  const { chunks } = at([...calibrate(), speech(3, -52, { remote: true, mine: false })]);
  const r = run(chunks);
  assert.equal(r.starts, 1, "echo of the other person must not start the gate");
  console.log("✓ the other person's voice from our speaker: not sent");
}
{ // 7b. A distant voice with "s" sounds now and then (single breathy chunks) is still not a whisper.
  const distant = speech(3, -47, { mine: false }).map((c, i) => (i % 6 === 2 ? { ...c, zcr: 0.35 } : i % 6 === 3 ? { ...c, zcr: 0.25 } : c));
  const { chunks } = at([...calibrate(), silence(8), distant]);
  assert.equal(run(chunks).starts, 1, "a distant voice's fricatives must not look like a whisper");
  console.log("✓ distant voice with 's' sounds: not mistaken for a whisper");
}
{ // 8. Deep / soft voice trailing off at the end of a sentence stays in it.
  const { chunks, idx } = at([silence(2), speech(2, -24), speech(1, -48), silence(2)]);
  const r = run(chunks);
  assert.ok(r.covered(idx[2], idx[3]) >= 0.95, `trailing soft words covered ${r.covered(idx[2], idx[3])}`);
  console.log("✓ soft trailing words: kept in the sentence");
}
console.log("\nVAD TESTS PASSED");
