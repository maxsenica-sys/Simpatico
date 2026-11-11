// End-to-end: two real Chromium instances with fake camera + synthetic speech, against a
// running server wired to test/mock-soniox.ts. Usage: BASE=http://localhost:3000 node test/e2e.mjs
import { createRequire } from "node:module";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = fileURLToPath(new URL("./out/", import.meta.url));
mkdirSync(OUT, { recursive: true });
const wav = fileURLToPath(new URL("./speech.wav", import.meta.url));
if (!existsSync(wav)) writeFileSync(wav, syntheticSpeech());

/** 6 cycles of a 2.4 s voiced burst (modulated harmonics) then 1.6 s of near-silence, 16 kHz mono. */
function syntheticSpeech() {
  const sr = 16000;
  const samples = [];
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let c = 0; c < 6; c++) {
    for (let i = 0; i < sr * 2.4; i++) {
      const t = i / sr;
      const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * t);
      const v = [180, 360, 540, 900].reduce((a, f, k) => a + Math.sin(2 * Math.PI * f * t) / (k + 1), 0);
      samples.push(v * 0.18 * env + rand() * 0.02);
    }
    for (let i = 0; i < sr * 1.6; i++) samples.push(rand() * 0.0005);
  }
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2));
  return buf;
}
const args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wav}`, "--autoplay-policy=no-user-gesture-required"];

const step = (s) => console.log(`• ${s}`);
const browserA = await chromium.launch({ args });
const browserB = await chromium.launch({ args });
const a = await (await browserA.newContext({ locale: "en-AU", viewport: { width: 1280, height: 800 }, permissions: ["camera", "microphone"] })).newPage();
const b = await (await browserB.newContext({ locale: "tr-TR", viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, permissions: ["camera", "microphone"] })).newPage();
for (const [n, p] of [["A", a], ["B", b]]) p.on("pageerror", (e) => console.log(`[${n} pageerror]`, e.message));

try {
  step("Personal call links open a room on demand; unknown short codes still don't");
  const personal = await fetch(BASE.replace(/\/$/, "") + "/api/rooms/k7mzq2wx4p");
  if (personal.status !== 200) throw new Error("personal link should open a room, got " + personal.status);
  const unknown = await fetch(BASE.replace(/\/$/, "") + "/api/rooms/zzzzzz");
  if (unknown.status !== 404) throw new Error("unknown short code should be 404, got " + unknown.status);

  step("A opens home and starts a call");
  await a.goto(BASE);
  await a.getByRole("button", { name: "Start a call" }).click();
  await a.waitForURL(/\/r\/[a-z0-9]{6}$/);
  const url = a.url();
  await a.getByText("You speak English").waitFor();
  await a.screenshot({ path: OUT + "1-host-join.png" });
  step("Name and gender are required before joining, for the host too");
  await a.getByRole("button", { name: "Join with video" }).click();
  await a.getByText("Add your name").waitFor();
  if (await a.locator(".call").count()) throw new Error("joined without a name");
  await a.locator(".field input").fill("Max");
  await a.getByRole("button", { name: "Join with video" }).click();
  await a.getByText("Choose an option").waitFor();
  if (await a.locator(".call").count()) throw new Error("joined without a gender");
  await a.locator(".gender-select").selectOption("m");
  await a.getByRole("button", { name: "Join with video" }).click();
  await a.getByText("Waiting for them to join").waitFor();
  await a.getByText("Send this link").waitFor();
  // Regression: the QR toggle sits where captions show; tapping it must not open the transcript.
  for (let i = 0; i < 2; i++) {
    const before = await a.locator(".qr-code").count();
    await a.locator(".call-status .qr-toggle").click();
    await a.waitForFunction((n) => document.querySelectorAll(".qr-code").length !== n, before);
    if (await a.getByRole("dialog").count()) throw new Error("the QR toggle opened the transcript");
  }
  if (!(await a.locator(".controls").isVisible())) throw new Error("call controls should always be visible");

  step("B (Turkish phone) opens the link: UI must be Turkish with no settings touched");
  // B chose Steady captions; A keeps the default (Live: settled phrases plus a faint preview).
  await b.addInitScript(() => localStorage.setItem("talk.captions.v1", JSON.stringify({ style: "steady", styleSet: true })));
  // Neither style ever shows Soniox's pass-1 guesses (which used to be rewritten): watch A's screen.
  // Settled caption text may only grow, never be rewritten (the faint preview may change).
  await a.evaluate(() => {
    window.__rewrites = [];
    const seen = new Map();
    const settled = (p) => [...p.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
    new MutationObserver(() => {
      for (const p of document.querySelectorAll(".cap[data-id]")) {
        const id = p.dataset.id, now = settled(p), before = seen.get(id);
        if (before && now && !now.startsWith(before)) window.__rewrites.push([before, now]);
        if (now) seen.set(id, now);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await b.goto(url);
  await b.getByText("Konuştuğun dil: Türkçe").waitFor();
  await b.screenshot({ path: OUT + "2-guest-join-tr.png" });
  await b.locator(".field input").fill("Ayşe");
  await b.locator(".gender-select").selectOption("f");
  await b.getByRole("button", { name: "Görüntülü katıl" }).click();

  step("WebRTC connects both ways");
  const videoUp = (p) => p.waitForFunction(() => { const v = document.querySelector("video.remote"); return v && v.videoWidth > 0 && !v.paused; }, null, { timeout: 25000 });
  await Promise.all([videoUp(a), videoUp(b)]);

  step("Captions arrive translated: settled phrases for both, plus the faint preview for Live (A)");
  await b.waitForFunction(() => [...document.querySelectorAll(".cap")].some((e) => e.textContent.includes("(Turkish)")), null, { timeout: 20000 });
  await a.waitForFunction(() => [...document.querySelectorAll(".cap")].some((e) => e.textContent.includes("(English)")), null, { timeout: 20000 });
  if (await b.locator(".cap-tail").count()) throw new Error("Steady captions must not show a preview");

  step("One-to-one captions say who is talking");
  await b.waitForFunction(() => [...document.querySelectorAll(".cap-who")].some((e) => e.textContent === "Max"), null, { timeout: 10000 });
  await a.waitForFunction(() => [...document.querySelectorAll(".cap-who")].some((e) => e.textContent === "Ayşe"), null, { timeout: 10000 });

  step("Pass-2 refinement swaps in");
  await b.waitForFunction(() => [...document.querySelectorAll(".cap.done")].some((e) => e.textContent.includes("(Turkish)")), null, { timeout: 20000 });
  await a.waitForFunction(() => [...document.querySelectorAll(".cap.done")].some((e) => e.textContent.includes("(English)")), null, { timeout: 20000 });
  const rewrites = await a.evaluate(() => window.__rewrites);
  if (rewrites.length) throw new Error("settled caption text was rewritten: " + JSON.stringify(rewrites));
  console.log("  A captions (steady):", await a.$$eval(".cap", (els) => els.map((e) => `[${e.className}] ${e.textContent}`)));
  await b.screenshot({ path: OUT + "3-guest-call.png" });
  await a.screenshot({ path: OUT + "4-host-call.png" });
  console.log("  B captions:", await b.$$eval(".cap", (els) => els.map((e) => `[${e.className}] ${e.textContent}`)));

  step("The Text button opens the transcript; caption settings sit behind their own button");
  await b.locator(".controls").getByRole("button", { name: "Konuşma dökümünü göster" }).click();
  await b.getByRole("heading", { name: "Konuşma dökümü" }).waitFor();
  if (await b.getByRole("radiogroup", { name: "Altyazı boyutu" }).count()) throw new Error("caption settings should start hidden");
  await b.getByRole("button", { name: "Altyazı ayarları" }).click();
  await b.getByRole("radiogroup", { name: "Altyazı boyutu" }).waitFor();

  step("Type to talk: A types a message, B gets it as a caption in Turkish");
  await b.getByRole("button", { name: "Kapat", exact: true }).click().catch(() => {});
  await a.locator(".controls").getByRole("button", { name: "Show transcript" }).click();
  await a.getByPlaceholder("Type a message…").fill("my flat is number 12");
  await a.getByRole("button", { name: "Send", exact: true }).click();
  await b.waitForFunction(() => [...document.querySelectorAll(".cap")].some((e) => e.textContent.includes("(Turkish) my flat is number 12")), null, { timeout: 10000 });
  await a.getByRole("button", { name: "Close", exact: true }).click();
  await b.locator(".controls").getByRole("button", { name: "Konuşma dökümünü göster" }).click();
  await b.getByRole("button", { name: "Altyazı ayarları" }).click();
  await b.getByRole("radiogroup", { name: "Altyazı boyutu" }).waitFor();

  step("B reports a translation as not right: that one line is saved, nothing else");
  const { readFileSync, existsSync, statSync } = await import("node:fs");
  const reportsFile = new URL("../data/reports.jsonl", import.meta.url);
  const before = existsSync(reportsFile) ? statSync(reportsFile).size : 0;
  await b.getByRole("button", { name: "Yanlış mı?" }).first().click();
  await b.getByText("Teşekkürler, gönderildi").first().waitFor();
  await b.waitForTimeout(500);
  const added = existsSync(reportsFile) ? readFileSync(reportsFile).subarray(before).toString("utf8").trim().split("\n").filter(Boolean) : [];
  if (added.length !== 1) throw new Error(`expected 1 report line, got ${added.length}`);
  const rep = JSON.parse(added[0]);
  if (!rep.source || !rep.translation || rep.to !== "tr") throw new Error("report should hold source, translation and languages: " + added[0]);
  console.log("  saved:", rep.from, "→", rep.to, "|", rep.source.slice(0, 40), "|", rep.translation.slice(0, 40));
  await b.waitForTimeout(500);
  await b.screenshot({ path: OUT + "5-guest-transcript.png" });
  console.log("  B transcript lines:", await b.$$eval(".tline", (els) => els.length));
  await b.getByRole("button", { name: "Kapat", exact: true }).click({ timeout: 5000 });

  // Helpers for the media checks below.
  const framesOn = (p) => p.evaluate(() => document.querySelector("video.remote")?.getVideoPlaybackQuality?.().totalVideoFrames ?? 0);
  const videoFlowing = async (p, ms = 20000) => {
    const t = Date.now();
    let prev = await framesOn(p);
    while (Date.now() - t < ms) {
      await p.waitForTimeout(1000);
      const now = await framesOn(p);
      if (now > prev + 5) return true;
      prev = now;
    }
    return false;
  };
  const show = (p) => p.evaluate(() => document.querySelector(".call")?.dispatchEvent(new MouseEvent("mousemove", { bubbles: true })));
  const placeholderText = (p) => p.evaluate(() => document.querySelector(".no-video p:not(.stage-name)")?.textContent ?? null);

  step("Captions-working check: A sees its own recognised words and a green captions badge");
  await a.waitForFunction(() => document.querySelector(".own-line")?.textContent?.length > 4, null, { timeout: 15000 });
  console.log("  A badge:", await a.locator(".cc-pill").textContent(), "| own line:", await a.locator(".own-line").textContent());

  step("Host and guest have the same controls");
  await show(a);
  await show(b);
  const labels = (p) => p.$$eval(".ctrl .ctrl-label", (els) => els.map((e) => e.textContent));
  const la = await labels(a), lb = await labels(b);
  console.log("  host:", la.join(" | "), "\n  guest:", lb.join(" | "));
  if (la.length < 5 || Math.abs(la.length - lb.length) > 1) throw new Error("host and guest controls differ"); // Flip only shows with 2 cameras

  step("Self view: tap for bigger, tap again for a 50/50 split, tap again back to small");
  await a.locator(".self").click();
  await a.locator(".self.big").waitFor({ timeout: 3000 });
  await a.locator(".self").click();
  await a.locator(".call.split .self.split").waitFor({ timeout: 3000 });
  await a.screenshot({ path: OUT + "10-host-split.png" });
  await a.locator(".self").click();
  await a.locator(".self.small").waitFor({ timeout: 3000 });
  if (await a.locator(".call.split").count()) throw new Error("split should be off again");

  step("B switches to another app: A is told B can't hear; it clears when B comes back");
  const setVisible = (p, visible) => p.evaluate((v) => {
    Object.defineProperty(document, "visibilityState", { value: v ? "visible" : "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }, visible);
  await setVisible(b, false);
  await a.getByText("Ayşe left the app for a moment").waitFor({ timeout: 8000 });
  await setVisible(b, true);
  await a.getByText("Ayşe left the app for a moment").waitFor({ state: "detached", timeout: 8000 });

  step("A turns the camera off: B sees 'camera off', captions keep working; then back on");
  await show(a);
  await a.getByRole("button", { name: "Turn camera off" }).click();
  await b.waitForFunction(() => document.querySelector(".no-video p:not(.stage-name)")?.textContent?.includes("kamerası kapalı"), null, { timeout: 10000 });
  console.log("  B placeholder:", await placeholderText(b));
  await b.screenshot({ path: OUT + "7-guest-sees-camera-off.png" });
  await show(a);
  await a.getByRole("button", { name: "Turn camera on" }).click();
  await b.waitForFunction(() => !document.querySelector(".no-video"), null, { timeout: 10000 });
  if (!(await videoFlowing(b))) throw new Error("A's video did not come back on B");
  console.log("  A's video back on B");

  step("Reported bug: A's camera dies mid-call (as iOS does in the background) -> auto-recovers");
  await a.evaluate(() => {
    const v = document.querySelector(".self video");
    v.srcObject.getVideoTracks().forEach((t) => t.stop()); // stop() fires no 'ended': only the health check can notice
  });
  const t0 = Date.now();
  await b.waitForTimeout(3000);
  const recovered = await videoFlowing(b, 25000);
  console.log(`  B receiving A's video again: ${recovered} after ${Math.round((Date.now() - t0) / 1000)} s`);
  if (!recovered) throw new Error("video did not self-heal");

  step("B switches to audio only: no video either way, A is told, captions still arrive at B");
  await show(b);
  await b.getByRole("button", { name: "Sadece sese geç" }).click();
  await b.waitForFunction(() => document.querySelector(".no-video p:not(.stage-name)")?.textContent?.includes("Sadece ses"), null, { timeout: 10000 });
  await a.getByText("They're on audio only").waitFor({ timeout: 10000 });
  await b.waitForFunction(() => document.querySelectorAll(".cap").length > 0, null, { timeout: 15000 });
  await b.screenshot({ path: OUT + "8-guest-audio-only.png" });
  await a.screenshot({ path: OUT + "9-host-partner-audio-only.png" });
  await show(b);
  await b.getByRole("button", { name: "Görüntüye geri dön" }).click();
  await a.waitForFunction(() => !document.querySelector(".no-video"), null, { timeout: 15000 });
  if (!(await videoFlowing(a))) throw new Error("B's video did not resume on A");
  if (!(await videoFlowing(b))) throw new Error("A's video did not resume on B");
  console.log("  video resumed both ways");

  step("A hangs up: B is told, upstream streams close");
  await show(a);
  await a.getByRole("button", { name: "End call" }).click();
  await a.getByText("Call ended").waitFor();
  await b.getByText("Max aramadan ayrıldı.").waitFor({ timeout: 10000 });
  await b.screenshot({ path: OUT + "6-guest-peer-left.png" });

  console.log("\nE2E PASSED");
} catch (err) {
  console.log("\nE2E FAILED:", err.message);
  await a.screenshot({ path: OUT + "fail-a.png" }).catch(() => {});
  await b.screenshot({ path: OUT + "fail-b.png" }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browserA.close();
  await browserB.close();
}
