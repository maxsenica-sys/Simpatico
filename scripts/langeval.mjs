#!/usr/bin/env node
// Translation check for one language, against the real translator (Claude) with the language's
// slang file as it is on THIS computer (server/slang/<lang>.ts), run on the temporary
// "lang-eval" machine so the live app is never slowed down.
//
//   node scripts/langeval.mjs <lang> <cases.json>
//
// cases.json:
//   {
//     "to_en":   ["everyday sentences in <lang>, as people really speak them", ...],
//     "from_en": ["casual English (Australian is fine) to translate into <lang>", ...],
//     "long":    ["one long run-on stretch of speech in <lang>, 30+ words", ...]
//   }
// Prints one line per sentence: "TO_EN | source => translation", "FROM_EN | …",
// "PHRASE | …" (the long ones are cut into phrases the way a call does it) and "WHOLE | …",
// plus "FIX" lines when the built-in checks had to correct something.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";

const [lang, casesPath] = process.argv.slice(2);
if (!lang || !casesPath) {
  console.error("usage: node scripts/langeval.mjs <lang> <cases.json>");
  process.exit(2);
}
const MACHINE = process.env.LANGEVAL_MACHINE ?? readFileSync(new URL("../.langeval-machine", import.meta.url), "utf8").trim();
const FLY = process.env.FLY ?? `${homedir()}/.fly/bin/flyctl`;
const cases = JSON.parse(readFileSync(casesPath, "utf8"));
const slang = readFileSync(new URL(`../server/slang/${lang}.ts`, import.meta.url), "utf8");

const script = `
import { phraseTranslate, refine } from "./server/refine.ts";
import { dropRepeat } from "./server/text.ts";
import { joinsForward } from "./server/pipeline.ts";
const LANG = ${JSON.stringify(lang)};
const cases = ${JSON.stringify(cases)};
const ctx = [{ who: "A", lang: "en-AU", text: "how are you going today" }, { who: "B", lang: LANG, text: cases.to_en?.[0] ?? "" }];
const base = { context: ctx, callNames: ["Max", "Ezgi"], callWords: ["Mia"], glossary: {} };
const run = async (items, f, n = 3) => { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await f(items[k]).catch((e) => "ERROR " + e); } })); return out; };
const to = await run(cases.to_en ?? [], (source) => refine({ ...base, source, sourceLang: LANG, targetLang: "en-AU", speaker: "B", speakerName: "Ezgi", people: { speaker: "f", listener: "m" }, signal: AbortSignal.timeout(12000) }));
(cases.to_en ?? []).forEach((s, i) => console.log("TO_EN | " + s + " => " + to[i]));
const from = await run(cases.from_en ?? [], (source) => refine({ ...base, source, sourceLang: "en-AU", targetLang: LANG, speaker: "A", speakerName: "Max", people: { speaker: "m", listener: "f" }, signal: AbortSignal.timeout(12000) }));
(cases.from_en ?? []).forEach((s, i) => console.log("FROM_EN | " + s + " => " + from[i]));
const spaced = (t) => /\\s/.test(t.trim());
for (const sentence of cases.long ?? []) {
  const units = spaced(sentence) ? sentence.split(/\\s+/) : Array.from(sentence.replace(/\\s+/g, ""));
  const sep = spaced(sentence) ? " " : "";
  const max = spaced(sentence) ? 9 : 18;
  let shown = "", before = [], i = 0;
  while (i < units.length) {
    let n = Math.min(max, units.length - i);
    if (i + n < units.length && spaced(sentence)) { let back = 0; while (n > 4 && back < 3 && joinsForward(units[i + n - 1], LANG.split("-")[0])) { n--; back++; } }
    const phrase = units.slice(i, i + n).join(sep);
    const final = i + n >= units.length;
    const ahead = final ? undefined : units.slice(i + n, i + n + 3).join(sep);
    const out = await phraseTranslate({ phrase, before: before.join(sep), shown, final, ahead, sourceLang: LANG, targetLang: "en-AU", context: ctx, callNames: ["Max", "Ezgi"], callWords: ["Mia"], speakerName: "Ezgi", people: { speaker: "f", listener: "m" }, signal: AbortSignal.timeout(12000) });
    const kept = out ? dropRepeat(shown, out) : out;
    console.log("PHRASE | " + phrase + " => " + out + (kept !== out ? "   [repeat dropped: " + kept + "]" : ""));
    before.push(phrase); if (kept) shown = (shown + " " + kept).trim();
    i += n;
  }
  console.log("WHOLE | " + shown);
}
process.exit(0);
`;
const d = `/tmp/ev-${lang}-${randomBytes(3).toString("hex")}`;
const b64 = (s) => Buffer.from(s).toString("base64");
const exec = (cmd, timeout = 60) => {
  try {
    return execFileSync(FLY, ["machine", "exec", MACHINE, "-a", "talk-calls", `sh -c '${cmd}'`, "--timeout", String(timeout)], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024, timeout: (timeout + 40) * 1000 });
  } catch (e) {
    return (e.stdout ?? "") + (e.stderr ?? "");
  }
};
// The machine takes commands of limited size: files go up in pieces.
const upload = (path, content) => {
  const data = b64(content);
  for (let i = 0; i < data.length; i += 9000) exec(`printf %s ${data.slice(i, i + 9000)} >> ${path}.b64`);
  exec(`base64 -d ${path}.b64 > ${path} && rm ${path}.b64`);
};
exec(`mkdir -p ${d} && cp -r /app/server /app/shared ${d}/ && ln -s /app/node_modules ${d}/node_modules`);
upload(`${d}/server/slang/${lang}.ts`, slang);
upload(`${d}/run.mts`, script);
const out = exec(`cd ${d} && /app/node_modules/.bin/tsx run.mts 2>&1; cd /; rm -rf ${d}`, 280);
for (const line of out.split("\n")) {
  if (/^(TO_EN|FROM_EN|PHRASE|WHOLE) \|/.test(line)) console.log(line);
  else if (/"event":"(leftover_fix|gender_check)"/.test(line)) console.log("FIX | " + line.replace(/^.*"event":/, ""));
  else if (/error|Error|ERR/.test(line) && !/"event":"(refine|phrase)_ok"/.test(line)) console.log("NOTE | " + line.slice(0, 300));
}
