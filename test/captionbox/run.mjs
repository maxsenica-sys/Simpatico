// Caption box test bench: real component, scripted calls, automatic checks.
//   node test/captionbox/run.mjs        (builds test/out/captionbox.js first)
// Scenarios: a 1:1 monologue with live previews that grow and shrink, a 3-person group call
// with people talking over each other, reading back with a finger while words keep coming,
// and starting again after a long pause. Each run counts what went wrong.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");
const root = fileURLToPath(new URL("../../", import.meta.url));
execFileSync(`${root}node_modules/.bin/esbuild`, ["test/captionbox/harness.tsx", "--bundle", "--outfile=test/out/captionbox.js", "--jsx=automatic", "--loader:.json=json", "--define:process.env.NODE_ENV=\"production\"", "--log-level=warning"], { cwd: root, stdio: "inherit" });

const only = process.argv[2];
const browser = await chromium.launch();

/** Runs inside the page: a scripted call plus the checks. */
async function scenario(name) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const box = () => document.querySelector(".cap-box-scroll");
  const state = new Map(); // id -> { text, tail, active }
  const send = (m) => {
    state.set(m.id, { text: m.text, tail: m.tail ?? "", active: m.stage !== "final", from: m.from });
    window.push(m);
  };
  const touch = { on: false, until: 0 };
  const problems = { missing: 0, hiddenWhileTalking: 0, newestOutOfView: 0, jumpsDown: 0, readBackMoved: 0, readBackLost: 0 };
  const examples = {};
  const note = (k, s) => {
    problems[k]++;
    (examples[k] ??= []).length < 3 && examples[k].push(s);
  };

  // --- monitor: every 50 ms
  let pendingMissing = new Set();
  let nextMissing = new Set();
  let readBack = null; // { id, top } of the first visible line while reading back
  let outSince = 0;
  const lastTop = new Map();
  let stop = false;
  (async () => {
    while (!stop) {
      await sleep(50);
      const el = box();
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const ps = [...el.querySelectorAll("p.cap")];
      const shown = new Map(ps.map((p) => [p.dataset.id, p]));
      const active = [...state.entries()].filter(([, s]) => s.active && (s.text || s.tail));
      const following = !touch.on && Date.now() > touch.until && !document.querySelector(".cap-latest");
      // 1. Every line still being translated is on screen, with its words.
      // (Counted when it's still wrong on the next check: a line sent a moment ago may not be drawn yet.)
      for (const [id, s] of active) {
        const p = shown.get(id);
        const wrong = !p ? `${id} not in the box` : s.text && !p.textContent.includes(s.text.slice(-20)) ? `${id} lacks "${s.text.slice(-20)}"` : null;
        if (wrong && pendingMissing.has(id + wrong)) note("missing", wrong);
        if (wrong) nextMissing.add(id + wrong);
      }
      pendingMissing = nextMissing;
      nextMissing = new Set();
      // 2. The box isn't hidden while someone is talking.
      const op = parseFloat(getComputedStyle(el).opacity);
      if (active.length && (op < 0.99 || !ps.length)) note("hiddenWhileTalking", `opacity ${op}, ${ps.length} lines`);
      // 3. Following: the newest words are in view (a glide may lag up to 0.5 s).
      if (following && active.length) {
        const newest = ps.at(-1);
        const nb = newest?.getBoundingClientRect().bottom ?? 0;
        if (nb > r.bottom + 6) {
          outSince ||= Date.now();
          if (Date.now() - outSince > 500) note("newestOutOfView", `${Math.round(nb - r.bottom)}px below for ${Date.now() - outSince} ms`);
        } else outSince = 0;
      } else outSince = 0;
      // 4. Following: no line moves down.
      for (const p of ps) {
        const top = p.getBoundingClientRect().top;
        const was = lastTop.get(p.dataset.id);
        if (following && was !== undefined && top - was > 3) note("jumpsDown", `${p.dataset.id} +${Math.round(top - was)}px`);
        lastTop.set(p.dataset.id, top);
      }
      // 5. Reading back: what you're looking at stays exactly where it is, and nothing vanishes.
      if (readBack) {
        const p = shown.get(readBack.id);
        if (!p) note("readBackLost", `${readBack.id} removed while reading`);
        else {
          const top = p.getBoundingClientRect().top;
          if (Math.abs(top - readBack.top) > 2) {
            note("readBackMoved", `${Math.round(top - readBack.top)}px`);
            readBack.top = top;
          }
        }
      }
    }
  })();

  // --- speech: words stream in, a phrase settles every few words, the preview after it
  // grows and sometimes shrinks (the translator catching up), then the line is final.
  const WORDS = "so I was thinking we could go to the market near the harbour tomorrow morning and then maybe have lunch with your mum if she is free because she said last week that she wanted to see the photos from the trip and I still have not sent them to her".split(" ");
  let seq = 0;
  const say = async (from, n, { wordMs = 300, overlapFinal = 700 } = {}) => {
    const id = `${from}-${++seq}~s`;
    const words = Array.from({ length: n }, (_, i) => WORDS[(i + seq * 7) % WORDS.length]);
    let settled = 0;
    for (let i = 1; i <= n; i++) {
      await sleep(wordMs);
      if (i - settled >= 6 + (seq % 3)) settled = i - 1 - (i % 2);
      // The preview: usually the rest, sometimes a word short, sometimes briefly empty.
      const k = i % 5 === 0 ? Math.max(settled, i - 2) : i % 7 === 0 ? settled : i;
      send({ from, id, stage: "steady", text: words.slice(0, settled).join(" "), tail: words.slice(settled, k).join(" ") || undefined });
    }
    // The closing phrase is translated after they stop: final a moment later (meanwhile the
    // next sentence may already have started).
    setTimeout(() => send({ from, id, stage: "final", text: words.join(" ") + "." }), overlapFinal);
  };

  const fingerBack = async () => {
    const el = box();
    // Only once there is something to scroll back to (the words no longer fit in the box).
    while (el.scrollHeight - el.clientHeight < 40) await sleep(100);
    const t = (type) => el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: [], changedTouches: [] }));
    touch.on = true;
    t("touchstart");
    for (let i = 0; i < 8; i++) {
      el.scrollTop = Math.max(0, el.scrollTop - 40);
      el.dispatchEvent(new Event("scroll"));
      t("touchmove");
      await sleep(30);
    }
    el.scrollTop = 0;
    el.dispatchEvent(new Event("scroll"));
    await sleep(200);
    t("touchend");
    touch.on = false;
    touch.until = Infinity; // reading back until Latest
    await sleep(100);
    const p = [...el.querySelectorAll("p.cap")].find((x) => x.getBoundingClientRect().bottom > el.getBoundingClientRect().top + 4);
    readBack = p ? { id: p.dataset.id, top: p.getBoundingClientRect().top } : null;
  };
  const latest = async () => {
    readBack = null;
    document.querySelector(".cap-latest")?.click();
    await sleep(900);
    touch.until = 0;
    lastTop.clear();
  };

  if (name === "monologue") {
    window.setNames(null);
    await say("a", 30);
    await sleep(400);
    await say("a", 45);
    await sleep(300);
    await say("a", 25);
    await sleep(1500);
  } else if (name === "group") {
    window.setNames({ a: "Ezgi", b: "Coach", c: "Ivan" });
    const A = say("a", 60, { wordMs: 280 });
    await sleep(2500);
    const B = say("b", 12, { wordMs: 320 });
    await sleep(1200);
    const C = say("c", 3, { wordMs: 300 });
    await Promise.all([B, C]);
    await sleep(1500);
    const C2 = say("c", 2);
    await A;
    await C2;
    await say("b", 20);
    await sleep(1500);
  } else if (name === "readback") {
    window.setNames(null);
    const A = say("a", 40);
    await sleep(6000);
    await fingerBack();
    await sleep(6000);
    await latest();
    await A;
    await say("a", 30);
    await sleep(1500);
  } else if (name === "readback-group") {
    window.setNames({ a: "Ezgi", b: "Coach" });
    const A = say("a", 50);
    await sleep(5000);
    const B = say("b", 15);
    await sleep(1000);
    await fingerBack();
    await sleep(7000);
    await latest();
    await Promise.all([A, B]);
    await sleep(1500);
  } else if (name === "pause") {
    window.setNames(null);
    await say("a", 8);
    await sleep(23000);
    await say("a", 10);
    await sleep(1500);
  } else if (name === "long-readback") {
    // Group, reading back for 30 s while three people keep talking and lines finish.
    window.setNames({ a: "Ezgi", b: "Coach", c: "Ivan" });
    const A = say("a", 40);
    await sleep(4000);
    await fingerBack();
    const B = say("b", 30);
    await sleep(3000);
    const C = say("c", 25);
    await Promise.all([A, B, C]);
    await say("a", 20);
    await sleep(3000);
    await latest();
    await say("b", 15);
    await sleep(1500);
  } else if (name === "scroll-down-resume") {
    // Back up a little, then back down by hand (no Latest): it follows the new words again.
    window.setNames(null);
    const A = say("a", 60);
    await sleep(7000);
    await fingerBack();
    await sleep(2000);
    readBack = null;
    const el = box();
    const t = (type) => el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: [], changedTouches: [] }));
    touch.on = true;
    t("touchstart");
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event("scroll"));
    t("touchmove");
    await sleep(150);
    t("touchend");
    touch.on = false;
    touch.until = Date.now() + 1200;
    lastTop.clear();
    await A;
    await sleep(1500);
    if (document.querySelector(".cap-latest")) note("newestOutOfView", "still showing Latest after scrolling back down");
  } else if (name === "tap-while-talking") {
    // A finger touches the box without scrolling (or brushes it) while words keep coming:
    // it must keep following the newest words.
    window.setNames(null);
    const A = say("a", 50);
    await sleep(7000);
    const el = box();
    const t = (type) => el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: [], changedTouches: [] }));
    for (let i = 0; i < 3; i++) {
      t("touchstart");
      await sleep(120);
      t("touchend");
      touch.until = Date.now() + 1500;
      await sleep(1500);
    }
    await A;
    await sleep(1500);
    if (document.querySelector(".cap-latest")) note("newestOutOfView", "a tap stopped it following the newest words");
  } else if (name === "long-quiet-other") {
    // Group: Coach says "ok" and goes quiet; Ezgi keeps talking for 30 s.
    window.setNames({ a: "Ezgi", b: "Coach" });
    const A = say("a", 100, { wordMs: 300 });
    await sleep(1500);
    await say("b", 1);
    await A;
    await sleep(1500);
  }
  stop = true;
  await sleep(100);
  return { problems, examples };
}

const names = ["monologue", "group", "readback", "readback-group", "long-readback", "scroll-down-resume", "tap-while-talking", "pause", "long-quiet-other"].filter((n) => !only || n === only);
let total = 0;
for (const name of names) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  page.on("pageerror", (e) => console.log("  page error:", e.message));
  await page.goto(`file://${root}test/out/captionbox.html`);
  await page.waitForFunction(() => typeof window.push === "function" && typeof window.setNames === "function");
  const { problems, examples } = await page.evaluate(scenario, name);
  const bad = Object.entries(problems).filter(([, n]) => n);
  total += bad.reduce((s, [, n]) => s + n, 0);
  console.log(`${bad.length ? "✗" : "✓"} ${name}${bad.length ? ": " + bad.map(([k, n]) => `${k} ×${n} (${examples[k].join("; ")})`).join(" | ") : ""}`);
  await page.close();
}
await browser.close();
console.log(total ? `\nCAPTION BOX: ${total} problems` : "\nCAPTION BOX TESTS PASSED");
process.exit(total ? 1 : 0);
