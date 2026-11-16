// Server-side pipeline checks against an in-process fake Soniox.
// Run: SONIOX_API_KEY=x SONIOX_URL=ws://localhost:3997 npx tsx test/pipeline.test.ts
import assert from "node:assert/strict";
import { WebSocketServer, type WebSocket } from "ws";

import { SpeakerPipeline } from "../server/pipeline";
import { isTrivialEdit } from "../server/text";
import { looksUntranslated, namesTag, relevantPeople, subtitleOnly } from "../server/refine";
import { sonioxContext } from "../server/vocab";
import { reply } from "./sse";

delete process.env.ANTHROPIC_API_KEY; // pass 2 off: utterances settle on the literal text
const wss = new WebSocketServer({ port: 3997 });
const sockets: WebSocket[] = [];
let configs = 0;
const configList: any[] = [];
wss.on("connection", (ws) => {
  sockets.push(ws);
  ws.once("message", (m) => {
    configList.push(JSON.parse(String(m)));
    configs++;
  });
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

const { createServer } = await import("node:http");
let interimCalls = 0;
/** "rewrite": whole-utterance rewrites fail; "all": every request fails (Claude down). */
let llmFail: "" | "rewrite" | "all" = "";
const phraseCalls: { text: string; final: boolean }[] = [];
const llm = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const j = JSON.parse(body);
    const interim = JSON.stringify(j.system).includes("still talking");
    if (interim) interimCalls++;
    const phrase = String(j.messages[0].content).match(/<new_phrase final="(\w+)">([\s\S]*?)<\/new_phrase>/);
    if (llmFail === "all" || (llmFail === "rewrite" && !phrase)) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "down" } }));
      return;
    }
    if (phrase) phraseCalls.push({ text: phrase[2], final: phrase[1] === "true" });
    const text = phrase ? `[${phrase[2].trim()}]` : interim ? "ARA-CEVIRI" : "TAM-CEVIRI";
    reply(res, j, "m", text);
  });
}).listen(3996);
process.env.ANTHROPIC_API_KEY = "x";
process.env.ANTHROPIC_BASE_URL = "http://localhost:3996";
reader.length = 0;
p.setLanguages("en-AU", "tr-TR");
p.audio(audio);
await until(() => configs === 4);
const ws4 = sockets[3];
assert.equal(configList[3].translation, undefined, "Claude writes the subtitles: Soniox only transcribes");
assert.ok(configList[0].translation, "without Claude, Soniox translates");
// 6. Live readers (default): a phrase settles once 8 words are safely recognised, and the words
//    after it show as a faint preview (tail) that is replaced, never the settled text.
const longLive = "so yesterday I went down to the market near the harbour and";
push(ws4, [tok(longLive, false)]);
await until(() => reader.some((m) => m.t === "caption" && m.style === "instant" && m.text.startsWith("[so yesterday")), 4000);
await until(() => reader.some((m) => m.t === "caption" && m.style === "instant" && /^\[harbour and\]$|^\[.*\]$/.test(m.tail ?? "")), 4000);
console.log("✓ live: settled phrase plus a faint preview of the words being spoken");
push(ws4, [tok(longLive + " bought fish", true), tok("<end>", true)]);
await until(() => reader.some((m) => m.t === "caption" && m.style === "instant" && m.stage === "final"), 4000);
const live = reader.filter((m) => m.t === "caption" && m.style === "instant");
for (let i = 1; i < live.length; i++) assert.ok(live[i].text.startsWith(live[i - 1].text), "settled text only grows");
assert.equal(live.at(-1).tail, undefined, "the final line has no preview");
assert.ok(!reader.some((m) => m.t === "caption" && !m.id.endsWith("~s")), "no word-by-word guesses when the LLM is on");
p.stop();
console.log("✓ live: no rewrites of settled text, final line clean");

// 6b. Steady captions: phrase by phrase from finalised words, append-only, closed by a final phrase.
//     With only steady readers, no interim calls are made and no whole-utterance rewrite is needed.
const steady: any[] = [];
const ps = new SpeakerPipeline({
  ref: "test-S",
  label: "A",
  toReader: (m) => steady.push(m),
  toSpeaker: () => {},
  context: () => [],
  record: () => {},
  glossary: () => ({}),
  styles: () => ({ steady: true, instant: false }),
});
const interimBefore = interimCalls;
ps.setLanguages("en-AU", "tr-TR");
ps.audio(audio);
await until(() => configs === 5);
const ws5 = sockets[4];
push(ws5, [tok("so yesterday I went to the market,", true), tok(" and I", false)]);
await until(() => steady.some((m) => m.stage === "steady" && m.text === "[so yesterday I went to the market,]"));
push(ws5, [tok(" and I bought some fresh fish", true)]);
// No clause end and under the length cap: a short pause ends the phrase.
await until(() => steady.some((m) => m.stage === "steady" && m.text.endsWith("[and I bought some fresh fish]")), 3000);
push(ws5, [tok(" for dinner.", true), tok("<end>", true)]);
await until(() => steady.some((m) => m.stage === "final"), 3000);
const shown = steady.filter((m) => m.t === "caption" && m.style === "steady").map((m) => m.text);
for (let i = 1; i < shown.length; i++) assert.ok(shown[i].startsWith(shown[i - 1]), `steady text only grows: ${shown[i - 1]} -> ${shown[i]}`);
assert.equal(shown.at(-1), "[so yesterday I went to the market,] [and I bought some fresh fish] [for dinner.]");
assert.ok(phraseCalls.at(-1)!.final, "the closing phrase is marked final");
assert.equal(interimCalls, interimBefore, "no interim calls without word-by-word readers");
ps.stop();
console.log("✓ steady captions: phrase by phrase, append-only, final phrase closes the line");

// 6c. Steady, short utterance: nothing shown while speaking, then the whole-utterance rewrite once.
steady.length = 0;
ps.setLanguages("en-AU", "tr-TR");
ps.audio(audio);
await until(() => configs === 6);
const ws6 = sockets[5];
push(ws6, [tok("see you", true)]);
await sleep(1200);
push(ws6, [tok(" soon", true), tok("<end>", true)]);
await until(() => steady.some((m) => m.style === "steady" && m.stage === "final"), 4000);
const short = steady.filter((m) => m.style === "steady");
assert.equal(short.length, 1, "one settled line, no intermediate guesses");
assert.equal(short[0].text, "TAM-CEVIRI");
console.log("✓ steady captions: a short sentence appears once, already idiomatic");

// 6c2. Claude's whole-utterance rewrite fails and Soniox isn't translating: the sentence is
//      translated again as one closing phrase instead of being lost.
ps.stop();
steady.length = 0;
llmFail = "rewrite";
ps.setLanguages("en-AU", "tr-TR");
ps.audio(audio);
await until(() => configs === 7);
push(sockets[6], [tok("see you soon", true), tok("<end>", true)]);
await until(() => steady.some((m) => m.style === "steady" && m.stage === "final"), 6000);
assert.equal(steady.filter((m) => m.style === "steady").at(-1).text, "[see you soon]");
llmFail = "";
ps.stop();
console.log("✓ no Soniox backup needed: a failed rewrite is translated again as a phrase");

// 6c3. Claude keeps failing: Soniox's own translation comes back on as the backup.
steady.length = 0;
llmFail = "all";
ps.setLanguages("en-AU", "tr-TR");
ps.audio(audio);
await until(() => configs === 8);
push(sockets[7], [tok("one two three four five six seven eight nine ten eleven twelve", true)]);
ps.audio(audio); // the next words reopen the stream (now translating)
await until(() => configs === 9 || (ps.audio(audio), false), 15000);
assert.ok(configList[8].translation, "Soniox translates while Claude is down");
llmFail = "";
ps.stop();
console.log("✓ Claude down: Soniox translation comes back on as the backup");

// 6d. Type to talk: the speaker sees their line, the reader gets it translated, once.
steady.length = 0;
const own: any[] = [];
const pt = new SpeakerPipeline({
  ref: "test-T", label: "A", toReader: (m) => steady.push(m), toSpeaker: (m) => own.push(m), context: () => [], record: () => {}, glossary: () => ({}),
});
pt.setLanguages("en-AU", "tr-TR");
pt.typed("my address is 12 Smith Street", true);
await until(() => steady.some((m) => m.stage === "final"), 4000);
assert.equal(steady.filter((m) => m.t === "caption").length, 1);
assert.equal(steady[0].text, "TAM-CEVIRI");
assert.ok(own.some((m) => m.t === "own" && m.final && m.text === "my address is 12 Smith Street"));
pt.stop();
ps.stop();
llm.close();
console.log("✓ type to talk: translated once for the reader, shown to the speaker");

// 7. Anti-flicker edit-distance rule
assert.equal(isTrivialEdit("Bunu yarın yaparız.", "bunu yarın yaparız"), true);
assert.equal(isTrivialEdit("I am going to the store tomorrow.", "I'm going to the store tomorrow."), true);
assert.equal(isTrivialEdit("break your leg", "good luck"), false);
console.log("✓ trivial-edit detection");

// A "translation" that is the source handed back is caught (Turkish in, Turkish out).
delete process.env.ECHO_CHECK;
assert.equal(looksUntranslated("bugün akşam yemeğe çıkalım mı", "bugün akşam yemeğe çıkalım mı?"), true);
assert.equal(looksUntranslated("bugün akşam yemeğe çıkalım mı", "Shall we go out for dinner tonight?"), false);
assert.equal(looksUntranslated("Ayşe", "Ayşe"), false);
console.log("✓ untranslated replies are rejected");

// Gender only goes to the translator where the words need it (English source).
assert.deepEqual(relevantPeople("I'm so tired", "en-AU", { speaker: "f" }), { speaker: "f", listener: undefined });
assert.equal(relevantPeople("My teacher was happy with us", "en-AU", { speaker: "f" }), undefined);
assert.deepEqual(relevantPeople("Are you ready?", "en", { speaker: "f", listener: "m" }), { speaker: undefined, listener: "m" });
assert.deepEqual(relevantPeople("Çok yoruldum", "tr", { speaker: "f" }), { speaker: "f" });
console.log("✓ gender is passed only where it matters");

// A name said in another accent: "Ezgi" heard as "esky". Recognition drops the competing slang
// term for this call, and the translator is told the word may be the name.
const ctxEzgi = sonioxContext("en-AU", ["Max", "Ezgi"]);
assert.ok(ctxEzgi.terms.includes("Ezgi") && !ctxEzgi.terms.includes("esky"), "esky gives way to Ezgi");
assert.ok(sonioxContext("en-AU", ["Max"]).terms.includes("esky"), "esky stays when no Ezgi is in the call");
assert.match(namesTag(["Max", "Ezgi"], "hey esky how was your day"), /"esky" may be Ezgi/);
assert.doesNotMatch(namesTag(["Max", "Ezgi"], "see you tomorrow"), /name_hints/);
console.log("✓ a name heard as a similar word is flagged, and doesn't lose to slang");

// A model second-guessing itself in the visible reply never reaches the screen.
assert.equal(subtitleOnly("Arre yaar, bas karo.\nWait, I should check: the target is English.\nHey, come on, enough already."), "Hey, come on, enough already.");
assert.equal(subtitleOnly("  Dude, that was legendary  "), "Dude, that was legendary");
assert.equal(subtitleOnly("Note: casual register\nSee you tomorrow!"), "See you tomorrow!");
assert.equal(subtitleOnly('"sarı gagalı ördekler için"'), "sarı gagalı ördekler için");
assert.equal(subtitleOnly("…and then we left"), "and then we left");
console.log("✓ subtitle-only cleanup");

wss.close();
console.log("\nPIPELINE TESTS PASSED");
process.exit(0);
