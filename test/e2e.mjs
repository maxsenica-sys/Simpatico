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
  step("A opens home and starts a call");
  await a.goto(BASE);
  await a.getByRole("button", { name: "Start a call" }).click();
  await a.waitForURL(/\/r\/[a-z0-9]{6}$/);
  const url = a.url();
  await a.getByText("Send this link").waitFor();
  await a.getByText("You speak English").waitFor();
  await a.screenshot({ path: OUT + "1-host-join.png" });
  await a.getByRole("button", { name: "Join with video" }).click();
  await a.getByText("Waiting for the other person").waitFor();

  step("B (Turkish phone) opens the link: UI must be Turkish with no settings touched");
  await b.goto(url);
  await b.getByText("Konuştuğun dil: Türkçe").waitFor();
  await b.screenshot({ path: OUT + "2-guest-join-tr.png" });
  await b.getByRole("button", { name: "Görüntülü katıl" }).click();

  step("WebRTC connects both ways");
  const videoUp = (p) => p.waitForFunction(() => { const v = document.querySelector("video.remote"); return v && v.videoWidth > 0 && !v.paused; }, null, { timeout: 25000 });
  await Promise.all([videoUp(a), videoUp(b)]);

  step("Pass-1 captions arrive, translated into each reader's language");
  await b.waitForFunction(() => [...document.querySelectorAll(".cap")].some((e) => e.textContent.includes("tr:")), null, { timeout: 20000 });
  await a.waitForFunction(() => [...document.querySelectorAll(".cap")].some((e) => e.textContent.includes("en:")), null, { timeout: 20000 });
  const liveOpacity = await b.evaluate(() => { const e = document.querySelector(".cap.live"); return e ? getComputedStyle(e).opacity : null; });
  console.log("  live caption opacity on B:", liveOpacity);

  step("Pass-2 refinement swaps in");
  await b.waitForFunction(() => [...document.querySelectorAll(".cap.done")].some((e) => e.textContent.includes("✨ (Turkish)")), null, { timeout: 20000 });
  await a.waitForFunction(() => [...document.querySelectorAll(".cap.done")].some((e) => e.textContent.includes("✨ (English)")), null, { timeout: 20000 });
  await b.screenshot({ path: OUT + "3-guest-call.png" });
  await a.screenshot({ path: OUT + "4-host-call.png" });
  console.log("  B captions:", await b.$$eval(".cap", (els) => els.map((e) => `[${e.className}] ${e.textContent}`)));

  step("Tap caption area opens the transcript");
  await b.locator(".captions-zone").click();
  await b.getByText("Konuşma dökümü").waitFor();
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
  const placeholderText = (p) => p.evaluate(() => document.querySelector(".no-video p")?.textContent ?? null);

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

  step("A turns the camera off: B sees 'camera off', captions keep working; then back on");
  await show(a);
  await a.getByRole("button", { name: "Turn camera off" }).click();
  await b.waitForFunction(() => document.querySelector(".no-video p")?.textContent?.includes("kamerası kapalı"), null, { timeout: 10000 });
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
  await b.waitForFunction(() => document.querySelector(".no-video p")?.textContent?.includes("Sadece ses"), null, { timeout: 10000 });
  await a.getByText("They switched to audio only").waitFor({ timeout: 10000 });
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
  await b.getByText("Karşı taraf aramadan ayrıldı.").waitFor({ timeout: 10000 });
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
