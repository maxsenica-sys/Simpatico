// In person (one phone, two people): words are routed to the right side by their language, and
// "let them talk first" settles their language from what they say. Fake Soniox and fake Claude.
// Run: npx tsx test/inperson.test.ts
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { reply } from "./sse";

process.env.SONIOX_API_KEY = "x";
process.env.SONIOX_URL = "ws://localhost:3994";
process.env.ANTHROPIC_API_KEY = "x";
process.env.ANTHROPIC_BASE_URL = "http://localhost:3993";
process.env.ECHO_CHECK = "off";

const configs: any[] = [];
const sockets: WebSocket[] = [];
const soniox = new WebSocketServer({ port: 3994 });
soniox.on("connection", (ws) => {
  sockets.push(ws);
  ws.once("message", (m) => configs.push(JSON.parse(String(m))));
});
const llm = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const j = JSON.parse(body);
    const content = String(j.messages[0].content);
    const lang = content.match(/<languages>.*? to (\w+)/)?.[1] ?? "?";
    const phrase = content.match(/<new_phrase final="\w+"[^>]*>([\s\S]*?)<\/new_phrase>/)?.[1] ?? content.match(/<utterance[^>]*>([\s\S]*?)<\/utterance>/)?.[1] ?? "";
    reply(res, j, "m", `[${lang}] ${phrase.trim()}`);
  });
}).listen(3993);

const { InPersonSession } = await import("../server/inperson");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (fn: () => boolean, ms = 4000) => {
  const t = Date.now();
  while (!fn()) {
    if (Date.now() - t > ms) throw new Error("timeout");
    await sleep(10);
  }
};
const tok = (text: string, language: string, is_final = true) => ({ text, is_final, language, translation_status: "original" });

function phone() {
  const got: any[] = [];
  const ws = { OPEN: 1, readyState: 1, send: (m: string) => got.push(JSON.parse(m)) } as any;
  return { session: new InPersonSession(ws, "test"), got };
}

// 1. Their language known: English to my side's pipeline (shown to them in Spanish), Spanish to theirs.
{
  const { session, got } = phone();
  session.message({ t: "start", mine: "en-AU", theirs: "es-ES" });
  session.audio(Buffer.alloc(3200));
  await until(() => configs.length === 1);
  assert.deepEqual(configs[0].language_hints, ["en", "es"]);
  assert.equal(configs[0].enable_language_identification, true);
  assert.equal(configs[0].language_hints_strict, false);
  assert.equal(configs[0].translation, undefined, "Claude translates; Soniox only transcribes");
  const ws = sockets[0];
  ws.send(JSON.stringify({ tokens: [tok("where is", "en"), tok(" the market", "en"), tok("<end>", "en")] }));
  await until(() => got.some((m) => m.t === "cap" && m.for === "them" && m.stage === "final"));
  assert.ok(got.some((m) => m.t === "own" && m.by === "me" && m.text === "where is the market" && m.final));
  assert.match(got.find((m) => m.t === "cap" && m.for === "them" && m.stage === "final").text, /^\[Spanish/);
  ws.send(JSON.stringify({ tokens: [tok("está a", "es"), tok(" dos calles", "es"), tok("<end>", "es")] }));
  await until(() => got.some((m) => m.t === "cap" && m.for === "me" && m.stage === "final"));
  assert.ok(got.some((m) => m.t === "own" && m.by === "them" && m.text === "está a dos calles" && m.final));
  assert.match(got.find((m) => m.t === "cap" && m.for === "me" && m.stage === "final").text, /^\[English/);
  session.close("test");
  console.log("✓ in person: each sentence goes to the right side by its language, translated for the other");
}

// 2. "Let them talk first": their language comes from their first words; those words aren't lost.
{
  const { session, got } = phone();
  session.message({ t: "start", mine: "en-AU", theirs: null });
  session.audio(Buffer.alloc(3200));
  await until(() => configs.length === 2);
  assert.deepEqual(configs[1].language_hints, ["en"]);
  assert.equal(configs[1].enable_language_identification, true);
  const ws = sockets[1];
  ws.send(JSON.stringify({ tokens: [tok("merhaba", "tr"), tok(" nasılsın", "tr")] }));
  await sleep(150);
  assert.ok(!got.some((m) => m.t === "lang"), "two words aren't enough to be sure");
  ws.send(JSON.stringify({ tokens: [tok(" bugün", "tr"), tok("<end>", "tr")] }));
  await until(() => got.some((m) => m.t === "lang"));
  assert.equal(got.find((m) => m.t === "lang").theirs, "tr");
  await until(() => got.some((m) => m.t === "cap" && m.for === "me" && m.stage === "final"));
  assert.ok(got.some((m) => m.t === "own" && m.by === "them" && /merhaba nasılsın bugün/.test(m.text)), "their first words are kept");
  session.close("test");
  console.log("✓ in person: their language is worked out from their first words, which aren't lost");
}

soniox.close();
llm.close();
console.log("\nIN PERSON TESTS PASSED");
process.exit(0);
