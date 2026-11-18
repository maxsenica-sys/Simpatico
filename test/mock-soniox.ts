// Local stand-in for Soniox's real-time WebSocket and the Anthropic Messages API, for tests.
// Soniox mock: ws://localhost:3999 — emits fake word tokens proportional to audio received,
// translation tokens trailing each finalized segment, and <end>/<fin> markers.
// LLM mock: http://localhost:3998/v1/messages — echoes "✨ <utterance>" after a delay.
import { reply } from "./sse";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const WORDS = "so I was thinking we could grab dinner later if you are free tonight".split(" ");
const wss = new WebSocketServer({ port: 3999 });
let openSockets = 0;

wss.on("connection", (ws, req) => {
  openSockets++;
  const auth = req.headers.authorization;
  let config: { language_hints: string[]; translation?: { target_language: string }; enable_language_identification?: boolean } | null = null;
  // In person (language identification on): sentences alternate between the two people, the
  // second one speaking Spanish unless the hints name their language.
  let sentence = 0;
  const lang = () => {
    if (!config?.enable_language_identification) return {};
    const [a, b] = [config.language_hints[0], config.language_hints[1] ?? "es"];
    return { language: sentence % 2 ? b : a };
  };
  const word = (w: string) => (config?.enable_language_identification && sentence % 2 ? `${config.language_hints[1] ?? "es"}~${w}` : w);
  let bytes = 0;
  let wordIdx = 0;
  let pendingWords: string[] = [];
  const send = (tokens: object[]) => ws.readyState === ws.OPEN && ws.send(JSON.stringify({ tokens, final_audio_proc_ms: 0, total_audio_proc_ms: 0 }));
  const translate = (words: string[]) => {
    const target = config?.translation?.target_language;
    if (!target) return;
    const tr = words.map((w) => `${target}:${w}`);
    // Trailing translation tokens: a non-final preview then the final version.
    setTimeout(() => send(tr.map((w, i) => ({ text: (i ? " " : "") + w, is_final: false, translation_status: "translation", language: target }))), 60);
    setTimeout(() => send(tr.map((w, i) => ({ text: (i ? " " : "") + w + (i === tr.length - 1 ? "." : ""), is_final: true, translation_status: "translation", language: target }))), 160);
  };
  const finalizeAll = (marker: string) => {
    const words = pendingWords;
    pendingWords = [];
    const toks = words.map((w, i) => ({ text: (i ? " " : "") + word(w), is_final: true, translation_status: config?.translation ? "original" : "none", ...lang() }));
    send([...toks, { text: marker, is_final: true, translation_status: config?.translation ? "original" : "none", ...lang() }]);
    translate(words);
    sentence++;
  };

  ws.on("message", (data, isBinary) => {
    if (!isBinary) {
      const s = data.toString();
      if (s === "") return ws.close(1000);
      const msg = JSON.parse(s);
      if (!config) {
        config = msg;
        console.log(JSON.stringify({ mock: "soniox_config", auth: auth?.slice(0, 12), hints: msg.language_hints, target: msg.translation?.target_language ?? null, open: openSockets, terms: msg.context?.terms?.slice(0, 6) }));
        return;
      }
      if (msg.type === "finalize") finalizeAll("<fin>");
      return;
    }
    bytes += (data as Buffer).length;
    // One "word" per 300 ms of audio (16 kHz * 2 bytes * 0.3 s).
    while (bytes >= 9600) {
      bytes -= 9600;
      pendingWords.push(WORDS[wordIdx++ % WORDS.length]);
      send(pendingWords.map((w, i) => ({ text: (i ? " " : "") + word(w), is_final: false, translation_status: config?.translation ? "original" : "none", ...lang() })));
      if (pendingWords.length >= 8) finalizeAll("<end>"); // endpoint on long runs
    }
  });
  ws.on("close", () => {
    openSockets--;
    console.log(JSON.stringify({ mock: "soniox_closed", open: openSockets }));
  });
});

let calls = 0;
createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const parsed = JSON.parse(body || "{}");
    const content: string = parsed.messages?.[0]?.content ?? "";
    const utterance = content.match(/<utterance[^>]*>([\s\S]*?)<\/utterance>/)?.[1] ?? "";
    // Steady captions: one phrase at a time, answered quickly and marked ◆.
    const phrase = content.match(/<new_phrase[^>]*>([\s\S]*?)<\/new_phrase>/)?.[1];
    // Live preview of the words still being spoken: marked ~.
    const fragment = content.match(/<fragment>([\s\S]*?)<\/fragment>/)?.[1];
    const target = content.match(/<languages>.* to (.*)<\/languages>/)?.[1] ?? "?";
    const hasContext = content.includes("<recent_conversation>");
    const n = ++calls;
    // Every 4th call is deliberately late, to exercise the 1500 ms deadline.
    const delay = phrase !== undefined || fragment !== undefined ? 250 : n % 4 === 0 ? 2200 : 350;
    console.log(JSON.stringify({ mock: "llm_call", n, target, hasContext, delay, model: parsed.model, thinking: parsed.thinking }));
    setTimeout(() => {
      if (res.destroyed) return;
      reply(res, parsed, `msg_${n}`, phrase !== undefined ? `◆ (${target}) ${phrase}` : fragment !== undefined ? `~ (${target}) ${fragment}` : `✨ (${target}) ${utterance}`);
    }, delay);
  });
}).listen(3998);

console.log(JSON.stringify({ mock: "ready", soniox: "ws://localhost:3999", llm: "http://localhost:3998" }));
