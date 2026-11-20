// A slow or dropped connection: mic audio waits on the phone and goes out in order; captions wait
// on the server for someone whose connection dropped. Run: npx tsx test/outbox.test.ts
import assert from "node:assert/strict";
import { AudioOutbox } from "../lib/outbox";
import { catchUp, deliver, type Peer } from "../server/rooms";

const sock = () => ({ readyState: WebSocket.OPEN, bufferedAmount: 0, sent: [] as (Uint8Array | string)[], send(x: Uint8Array | string) { this.sent.push(x); this.bufferedAmount += typeof x === "string" ? x.length : x.byteLength; } }) as any;
const frame = (n: number) => new Uint8Array([n, 0, 0, 0]);

// 1. Fine connection: each frame goes straight out.
let ob = new AudioOutbox();
let ws = sock();
ob.audio(ws, frame(1), -20, true);
ob.audio(ws, frame(2), -20, true);
assert.equal(ws.sent.length, 2);
assert.equal(ob.behindMs, 0);
console.log("✓ a good connection sends audio straight away");

// 2. Slow connection: frames wait, then go out in order with the speech marks in place.
ob = new AudioOutbox();
ws = sock();
ws.bufferedAmount = 100_000; // the network can't keep up
for (let i = 1; i <= 5; i++) ob.audio(ws, frame(i), -20, true);
ob.mark(ws, JSON.stringify({ t: "speech", on: false }), true);
ob.audio(ws, frame(6), -20, true);
assert.equal(ws.sent.length, 0, "nothing sent while the socket is backed up");
assert.equal(ob.behindMs, 600);
ws.bufferedAmount = 0;
ws.sent = [];
ob.flush(ws);
assert.deepEqual(ws.sent.map((x: Uint8Array | string) => (typeof x === "string" ? "end" : x[0])), [1, 2, 3, 4, 5, "end", 6], "all of it, in order, the end-of-speech mark after its words");
console.log("✓ a slow connection loses nothing: audio waits and goes out in order");

// 3. Dropped connection, then back: everything said meanwhile is sent once it has rejoined.
ob = new AudioOutbox();
for (let i = 1; i <= 3; i++) ob.audio(null, frame(i), -20, false);
ws = sock();
ob.audio(ws, frame(4), -20, false); // reconnected but not rejoined yet: keep waiting
assert.equal(ws.sent.length, 0);
ob.flush(ws);
assert.equal(ws.sent.length, 4);
console.log("✓ words said while the connection was down are sent when it's back");

// 4. Long silence while waiting is shortened (a little kept, so sentence ends are still heard).
ob = new AudioOutbox();
ob.audio(null, frame(1), -20, false);
for (let i = 0; i < 50; i++) ob.audio(null, frame(9), -80, false);
assert.equal(ob.behindMs, 700, "the speech plus 0.6 s of the pause");
console.log("✓ pauses are shortened while audio is waiting");

// 5. Captions for someone whose connection dropped wait for them; previews don't.
const away = { ws: null, missed: [] } as unknown as Peer;
deliver(away, { t: "caption", id: "u1", from: "p1", stage: "live", text: "hel" } as any);
deliver(away, { t: "caption", id: "u1", from: "p1", stage: "final", text: "Hello" } as any);
deliver(away, { t: "caption", id: "u1", from: "p1", stage: "final", text: "Hello there" } as any);
deliver(away, { t: "caption", id: "u2", from: "p1", stage: "final", text: "How are you?" } as any);
assert.equal(away.missed.length, 2, "one entry per line, the latest version");
const back = { OPEN: 1, readyState: 1, sent: [] as any[], send(m: string) { this.sent.push(JSON.parse(m)); } };
(away as any).ws = back;
catchUp(away);
assert.deepEqual(back.sent.map((m: any) => m.text), ["Hello there", "How are you?"]);
assert.equal(away.missed.length, 0);
console.log("✓ captions missed during a dropout arrive when they're back");
