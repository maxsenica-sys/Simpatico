// Server-side pipeline checks against an in-process fake Soniox.
// Run: SONIOX_API_KEY=x SONIOX_URL=ws://localhost:3997 npx tsx test/pipeline.test.ts
import assert from "node:assert/strict";
import { WebSocketServer, type WebSocket } from "ws";

import { SpeakerPipeline } from "../server/pipeline";
import { isTrivialEdit } from "../server/text";

delete process.env.ANTHROPIC_API_KEY; // pass 2 off: utterances settle on the literal text
const wss = new WebSocketServer({ port: 3997 });
const sockets: WebSocket[] = [];
let configs = 0;
wss.on("connection", (ws) => {
  sockets.push(ws);
  ws.once("message", () => configs++);
});
const openCount = () => sockets.filter((s) => s.readyState === s.OPEN).length;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (fn: () => boolean, ms = 3000) => {
  const t = Date.now();
  while (!fn()) {
    if (Date.now() - t > ms) throw new Error("timeout");
    await sleep(10);
  }
};
const tok = (text: string, is_final: boolean, tr = false) => ({ text, is_final, translation_status: tr ? "translation" : "original" });
const push = (ws: WebSocket, tokens: object[]) => ws.send(JSON.stringify({ tokens }));

const reader: any[] = [];
const speaker: any[] = [];
const p = new SpeakerPipeline({
  ref: "test-A",
  label: "A",
  toReader: (m) => reader.push(m),
  toSpeaker: (m) => speaker.push(m),
  context: () => [],
  record: () => {},
  glossary: () => ({}),
});
const audio = Buffer.alloc(3200);

// 1. No reader -> no upstream stream (never bill for an empty room)
p.setLanguages("en-AU", null);
p.audio(audio);
await sleep(100);
assert.equal(openCount(), 0, "no stream without a reader");

// 2. Live captions, then an endpoint settles the utterance with the late translation tail attached
p.setLanguages("en-AU", "tr-TR");
p.audio(audio);
await until(() => configs === 1);
const ws1 = sockets[0];
push(ws1, [tok("break", true), tok(" a leg", false)]);
push(ws1, [tok("break", false, true)]);
await until(() => reader.some((m) => m.t === "caption" && m.stage === "live" && m.text === "break"));
push(ws1, [tok(" a leg", true), tok("<end>", true)]);
push(ws1, [tok(" bacağını kır.", false, true)]);
push(ws1, [tok("break a leg.", true, true)]);
await until(() => reader.some((m) => m.t === "caption" && m.stage === "final"));
const fin = reader.find((m) => m.t === "caption" && m.stage === "final") as { text: string };
assert.equal(fin.text, "break a leg.", "translation tail is attributed to the closed utterance");
assert.ok(speaker.some((m) => m.t === "own" && m.final && m.text === "break a leg"), "speaker gets own transcript");

// 2b. Real Soniox order (verified live): final originals, final translation, THEN <end>.
// The speaker's line must still be marked final even though its text didn't change at <end>.
speaker.length = 0;
reader.length = 0;
push(ws1, [tok("Really?", true)]);
push(ws1, [tok("Gerçekten mi?", true, true)]);
await until(() => speaker.some((m) => m.t === "own" && m.text === "Really?"));
push(ws1, [tok("<end>", true)]);
await until(() => speaker.some((m) => m.t === "own" && m.final && m.text === "Really?"));
await until(() => reader.some((m) => m.t === "caption" && m.stage === "final" && m.text === "Gerçekten mi?"));
console.log("✓ real token order: translation before <end>, own line finalised");
console.log("✓ live → final, translation tail attributed correctly");

// 3. Upstream drop: reader told captions paused, next audio transparently reconnects
reader.length = 0;
ws1.terminate();
await until(() => reader.some((m) => m.t === "captions" && m.state === "paused"));
p.audio(audio);
await until(() => configs === 2, 4000);
await until(() => reader.some((m) => m.t === "captions" && m.state === "ok"));
console.log("✓ drop → paused → reconnect → ok");

// 4. Participant leaves: upstream closed immediately
p.stop();
await until(() => openCount() === 0, 1000);
console.log("✓ stop closes the upstream socket immediately");

// 5. Same language: transcribe only, no translation, settle straight away
reader.length = 0;
p.setLanguages("en-AU", "en-US");
p.audio(audio);
await until(() => configs === 3);
const ws3 = sockets[2];
push(ws3, [tok("hello there", true), tok("<fin>", true)]);
await until(() => reader.some((m) => m.t === "caption" && m.stage === "final" && m.text === "hello there"));
p.stop();
console.log("✓ same-language pair transcribes without translating");

// 6. Long utterance: an interim LLM translation of the untranslated tail shows while the
//    speaker is still talking, and Soniox's own translation supersedes it.
const { createServer } = await import("node:http");
let interimCalls = 0;
const llm = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const j = JSON.parse(body);
    const interim = String(j.system).includes("still talking");
    if (interim) interimCalls++;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "m", type: "message", role: "assistant", model: j.model, stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: interim ? "ARA-CEVIRI" : "TAM-CEVIRI" }] }));
  });
}).listen(3996);
process.env.ANTHROPIC_API_KEY = "x";
process.env.ANTHROPIC_BASE_URL = "http://localhost:3996";
reader.length = 0;
p.setLanguages("en-AU", "tr-TR");
p.audio(audio);
await until(() => configs === 4);
const ws4 = sockets[3];
const longLive = "so yesterday I went down to the market near the harbour and";
push(ws4, [tok(longLive, false)]);
await sleep(1300); // nothing translated for > 1.2 s
push(ws4, [tok(longLive + " bought", false)]);
await until(() => reader.some((m) => m.t === "caption" && m.stage === "live" && m.text.includes("ARA-CEVIRI")), 4000);
console.log("✓ interim translation shown while a long sentence is still being spoken");
push(ws4, [tok(longLive + " bought fish", true)]);
push(ws4, [tok("dün limana yakın pazara gittim ve balık aldım", true, true)]);
await until(() => reader.some((m) => m.t === "caption" && m.stage === "live" && m.text.includes("balık") && !m.text.includes("ARA-CEVIRI")));
console.log("✓ Soniox's translation supersedes the interim");
push(ws4, [tok("<end>", true)]);
await until(() => reader.some((m) => m.t === "caption" && m.stage === "refined" && m.text === "TAM-CEVIRI"), 4000);
p.stop();
llm.close();
assert.ok(interimCalls >= 1);

// 7. Anti-flicker edit-distance rule
assert.equal(isTrivialEdit("Bunu yarın yaparız.", "bunu yarın yaparız"), true);
assert.equal(isTrivialEdit("I am going to the store tomorrow.", "I'm going to the store tomorrow."), true);
assert.equal(isTrivialEdit("break your leg", "good luck"), false);
console.log("✓ trivial-edit detection");

wss.close();
console.log("\nPIPELINE TESTS PASSED");
process.exit(0);
