// End-to-end: someone taps "Don't Allow" for camera and mic. No error screen: they can join
// anyway, the other person is told, and tapping Mic later asks again and goes live mid-call.
// Usage: BASE=http://localhost:3000 node test/e2e-perms.mjs (server wired to test/mock-soniox.ts)
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE ?? "http://localhost:3000";
const step = (s) => console.log("•", s);
const fake = ["--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"];
// A's phone answers "Don't Allow" (NotAllowedError, as phones do) until the test lets it allow.
const browserA = await chromium.launch({ args: [...fake, "--use-fake-ui-for-media-stream"] });
const browserB = await chromium.launch({ args: [...fake, "--use-fake-ui-for-media-stream"] });
const ctxA = await browserA.newContext({ locale: "en-AU", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctxA.addInitScript(() => {
  const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  const allowed = () => sessionStorage.getItem("allow") || "";
  navigator.mediaDevices.getUserMedia = async (c) => {
    const want = [c?.audio ? "mic" : "", c?.video ? "cam" : ""].filter(Boolean);
    if (want.some((k) => !allowed().includes(k))) throw new DOMException("Permission denied", "NotAllowedError");
    return real(c);
  };
  // Like a phone that hasn't been asked yet, so the explainer shows.
  const q = navigator.permissions.query.bind(navigator.permissions);
  navigator.permissions.query = (d) => (d.name === "camera" || d.name === "microphone" ? Promise.resolve({ state: "prompt" }) : q(d));
});
const a = await ctxA.newPage();
const b = await (await browserB.newContext({ locale: "en-AU", viewport: { width: 390, height: 844 }, permissions: ["camera", "microphone"] })).newPage();
for (const p of [a, b]) p.on("pageerror", (e) => console.log("  page error:", e.message));

try {
  step("A starts a call but refuses camera and mic");
  await a.goto(BASE);
  await a.evaluate(() => {
    localStorage.setItem("talk.name", "Max");
    localStorage.setItem("talk.gender", "m");
  });
  await a.getByRole("button", { name: /start a call/i }).click();
  await a.waitForURL(/\/r\//);
  const url = a.url();
  // First visit: a short explainer comes before the phone's own question.
  const cont = a.getByRole("button", { name: "Continue" });
  if (await cont.waitFor({ timeout: 5000 }).then(() => true).catch(() => false)) {
    console.log("  explainer shown before the phone asks");
    await cont.click();
  }
  await a.getByText("Camera and mic are off").waitFor({ timeout: 10000 });
  if (await a.getByText(/blocked/i).count()) throw new Error("an error screen was shown");
  console.log("  no error: 'Camera and mic are off' with Allow and Join anyway");

  step("Allow again while still refused: still no error, now with how-to steps");
  await a.getByRole("button", { name: "Allow camera & mic" }).click();
  await a.getByText(/allow Camera and Microphone/i).waitFor({ timeout: 10000 });

  step("A joins anyway; B joins normally; they connect");
  await a.getByRole("button", { name: "Join anyway" }).click();
  await b.goto(url + "?debug");
  await b.evaluate(() => {
    localStorage.setItem("talk.name", "Ezgi");
    localStorage.setItem("talk.gender", "f");
  });
  await b.reload();
  await b.getByRole("button", { name: /join with video/i }).click();
  await a.waitForFunction(() => {
    const v = document.querySelector("video.remote");
    return v && v.videoWidth > 0;
  }, null, { timeout: 20000 });
  console.log("  A sees B's video without having a camera or mic");

  step("B is told A's mic isn't on; A sees how to turn it on");
  await b.waitForFunction(() => !!window.__call, null, { timeout: 5000 });
  await b.getByText("Max hasn't turned on their microphone yet.").waitFor({ timeout: 10000 });
  await a.getByText("Your microphone is off. Tap Mic to turn it on.").waitFor();

  step("A taps Mic and this time allows it: mic goes live mid-call, B's notice clears");
  await a.evaluate(() => sessionStorage.setItem("allow", "mic"));
  await a.getByRole("button", { name: "Unmute" }).click();
  await b.getByText("Max hasn't turned on their microphone yet.").waitFor({ state: "detached", timeout: 10000 });
  const packets = () =>
    b.evaluate(async () => {
      let n = 0;
      for (const l of window.__call.links.values()) {
        const st = await l.pc?.getStats();
        st?.forEach((r) => {
          if (r.type === "inbound-rtp" && r.kind === "audio") n += r.packetsReceived ?? 0;
        });
      }
      return n;
    });
  const p0 = await packets();
  await b.waitForTimeout(2500);
  const p1 = await packets();
  const flowing = p1 - p0 > 50;
  console.log(`  B received ${p1 - p0} audio packets from A in 2.5 s`);
  if (!flowing) throw new Error("A's mic didn't reach B");

  console.log("\nPERMISSIONS E2E PASSED");
} catch (err) {
  console.log("\nPERMISSIONS E2E FAILED:", err.message);
  await a.screenshot({ path: "test/out/perms-fail-a.png" }).catch(() => {});
  await b.screenshot({ path: "test/out/perms-fail-b.png" }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browserA.close();
  await browserB.close();
}
