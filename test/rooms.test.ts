// Group-room logic: per-language pipelines and in-room floor control. Run: npx tsx test/rooms.test.ts
import assert from "node:assert/strict";
import { admitAudio, createRoom, seat, stopSpeaking, updatePipelines } from "../server/rooms";

const fakeWs = () => ({ OPEN: 1, readyState: 1, sent: [] as unknown[], send(m: string) { this.sent.push(JSON.parse(m)); }, close() {} }) as any;
const lang = (code: string) => ({ speaks: code, reads: code, ui: code });

const room = createRoom("group")!;
const coach = seat(room, "coach-0001", lang("tr-TR"), fakeWs(), { name: "Coach", inRoom: true });
const ivan = seat(room, "ivan-00001", lang("ru-RU"), fakeWs(), { name: "Ivan", inRoom: true });
const me = seat(room, "max-000001", lang("en-AU"), fakeWs(), { name: "Max", inRoom: false });
const ayse = seat(room, "ayse-00001", lang("tr-TR"), fakeWs(), { name: "Ayşe", inRoom: true });
assert.ok(coach !== "room-full" && ivan !== "room-full" && me !== "room-full" && ayse !== "room-full");
const [C, I, M, A] = [coach, ivan, me, ayse].map((r) => (r as Exclude<typeof r, "room-full">).peer);

// 1. Per-language pipelines: each speaker's speech goes to every OTHER language present.
updatePipelines(room);
assert.deepEqual([...C.pipelines.keys()].sort(), ["en", "ru"], "coach (tr) -> en for Max, ru for Ivan");
assert.deepEqual([...I.pipelines.keys()].sort(), ["en", "tr"], "Ivan (ru) -> en, tr");
assert.deepEqual([...M.pipelines.keys()].sort(), ["ru", "tr"], "Max (en) -> ru, tr");
assert.equal(C.primaryKey, "en"); // tie on count (1 each) -> alphabetical
assert.equal(A.primaryKey, "en");
console.log("✓ one pipeline per other language; same-language readers get the original words");

// 2. Floor control among in-room phones.
const t0 = 1_000_000;
assert.equal(admitAudio(room, C, -20, t0), true, "coach talks into his own phone: gets the floor");
assert.equal(admitAudio(room, I, -34, t0 + 100), false, "Ivan's phone hears the coach from across the room: dropped");
assert.equal(admitAudio(room, A, -30, t0 + 150), false, "Ayşe's phone too");
assert.equal(admitAudio(room, M, -25, t0 + 160), true, "Max is remote: always captioned");
assert.equal(admitAudio(room, C, -21, t0 + 200), true, "coach keeps the floor");
assert.equal(admitAudio(room, A, -8, t0 + 300), true, "Ayşe speaks right into her phone, clearly louder: takes over");
assert.equal(admitAudio(room, C, -22, t0 + 400), false, "coach's phone now only hears Ayşe from afar");
console.log("✓ in-room floor: nearest phone wins, echoes of the same voice are dropped");

// 3. After the speaker stops, a much quieter phone hearing the tail of the same voice is ignored,
//    but a normal-level new speaker gets the floor.
stopSpeaking(room, A);
assert.equal(room.floor, null);
assert.equal(admitAudio(room, I, -30, Date.now() + 100), false, "tail of Ayşe's voice on Ivan's phone: ignored");
assert.equal(admitAudio(room, I, -12, Date.now() + 200), true, "Ivan himself speaks: floor");
console.log("✓ release: quiet echoes ignored, real new speaker admitted");

console.log("\nROOM TESTS PASSED");
process.exit(0);
