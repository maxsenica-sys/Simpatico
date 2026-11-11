// End-to-end: "call them again" from Recent, no invitation. Max and Ezgi have one ordinary call;
// afterwards Ezgi opens the app (Max sees "Active now"), Max taps her in Recent and lands in
// their own room, Ezgi's home says "Max is waiting for you", one tap and they're connected.
// Usage: BASE=http://localhost:3000 node test/e2e-pair.mjs (server wired to test/mock-soniox.ts)
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE ?? "http://localhost:3000";
const step = (s) => console.log("•", s);
const args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"];
const bA = await chromium.launch({ args });
const bB = await chromium.launch({ args });
const opts = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["camera", "microphone"] };
const max = await (await bA.newContext({ ...opts, locale: "en-AU" })).newPage();
const ezgi = await (await bB.newContext({ ...opts, locale: "en-AU" })).newPage();
for (const p of [max, ezgi]) p.on("pageerror", (e) => console.log("  page error:", e.message));
const setup = ([name, g]) => {
  localStorage.setItem("talk.name", name);
  localStorage.setItem("talk.gender", g);
  localStorage.setItem("talk.mediaOk", "1");
};
const connected = (p) => p.waitForFunction(() => { const v = document.querySelector("video.remote"); return v && v.videoWidth > 0; }, null, { timeout: 20000 });

try {
  step("An ordinary call first: Max starts it, Ezgi joins from the link");
  await max.goto(BASE);
  await max.evaluate(setup, ["Max", "m"]);
  await ezgi.goto(BASE);
  await ezgi.evaluate(setup, ["Ezgi", "f"]);
  await max.reload();
  await max.getByRole("button", { name: /start a call/i }).click();
  await max.waitForURL(/\/r\/[a-z0-9]{6}$/);
  const firstRoom = max.url();
  await max.getByRole("button", { name: /join with video/i }).click();
  await ezgi.goto(firstRoom);
  await ezgi.getByRole("button", { name: /join with video/i }).click();
  await connected(max);
  await max.waitForTimeout(2500); // phones swap keys and work out their shared room
  const pairMax = await max.evaluate(() => JSON.parse(localStorage.getItem("talk.recent.v1"))[0]);
  const pairEzgi = await ezgi.evaluate(() => JSON.parse(localStorage.getItem("talk.recent.v1"))[0]);
  console.log(`  Max's Recent: ${pairMax.name} (room ${pairMax.pair}); Ezgi's Recent: ${pairEzgi.name} (room ${pairEzgi.pair})`);
  if (!pairMax.pair || pairMax.pair !== pairEzgi.pair) throw new Error("the two phones didn't agree on a shared room");
  await max.getByRole("button", { name: "End call" }).click();
  await ezgi.waitForTimeout(1000);

  step("Later: Ezgi opens the app; Max's home shows her as Active now");
  await ezgi.goto(BASE);
  await max.goto(BASE);
  await max.getByText("Active now").waitFor({ timeout: 25000 });
  console.log("  Max sees: Ezgi · Active now");

  step("Max taps Ezgi in Recent: straight to their own room, no invite");
  await max.getByRole("button", { name: "Call Ezgi" }).click();
  await max.waitForURL(new RegExp(`/r/${pairMax.pair}$`));
  if (await max.getByText(/send this link|copy link/i).count()) throw new Error("an invite was shown");
  await max.getByRole("button", { name: /join with video/i }).click();

  step("Ezgi's home says Max is waiting; one tap and they're connected");
  await ezgi.getByText("Max is waiting for you").waitFor({ timeout: 20000 });
  await ezgi.getByRole("button", { name: /Max is waiting for you/ }).first().click();
  await ezgi.waitForURL(new RegExp(`/r/${pairMax.pair}$`));
  await ezgi.getByRole("button", { name: /join with video/i }).click();
  await connected(max);
  await connected(ezgi);
  console.log("  connected in their own room");

  console.log("\nPAIR E2E PASSED");
} catch (err) {
  console.log("\nPAIR E2E FAILED:", err.message);
  await max.screenshot({ path: "test/out/pair-fail-max.png" }).catch(() => {});
  await ezgi.screenshot({ path: "test/out/pair-fail-ezgi.png" }).catch(() => {});
  process.exitCode = 1;
} finally {
  await bA.close();
  await bB.close();
}
