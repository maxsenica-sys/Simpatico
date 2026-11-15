// End-to-end: report and block. Max and Ezgi have a call; Max blocks Ezgi from her name on the
// call screen. The call ends, she leaves his Recent, and when she taps him later she's told he
// isn't available. Max unblocks her on the Me page and she can reach him again.
// Usage: BASE=http://localhost:3000 node test/e2e-block.mjs (server wired to test/mock-soniox.ts)
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3000";
const step = (s) => console.log("•", s);
const args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"];
const bA = await chromium.launch({ args });
const bB = await chromium.launch({ args });
const opts = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["camera", "microphone"], locale: "en-AU" };
const max = await (await bA.newContext(opts)).newPage();
const ezgi = await (await bB.newContext(opts)).newPage();
const setup = ([name, g]) => {
  localStorage.setItem("talk.name", name);
  localStorage.setItem("talk.gender", g);
  localStorage.setItem("talk.mediaOk", "1");
};
const connected = (p) => p.waitForFunction(() => { const v = document.querySelector("video.remote"); return v && v.videoWidth > 0; }, null, { timeout: 20000 });
try {
  step("A call between Max and Ezgi (their shared room gets set up)");
  await max.goto(BASE); await max.evaluate(setup, ["Max", "m"]);
  await ezgi.goto(BASE); await ezgi.evaluate(setup, ["Ezgi", "f"]);
  await max.reload();
  await max.getByRole("button", { name: /start a call/i }).click();
  await max.waitForURL(/\/r\//);
  const room = max.url();
  await max.getByRole("button", { name: /join with video/i }).click();
  await ezgi.goto(room);
  await ezgi.getByRole("button", { name: /join with video/i }).click();
  await connected(max);
  await max.waitForTimeout(2500);
  const pair = await max.evaluate(() => JSON.parse(localStorage.getItem("talk.recent.v1"))[0].pair);

  step("Max taps Ezgi's name on the call screen > Block Ezgi: the call ends");
  await max.getByRole("button", { name: "Report or block Ezgi" }).first().click();
  await max.getByRole("button", { name: "Block Ezgi", exact: true }).click();
  await max.getByText("Ezgi is blocked.").waitFor();
  await max.getByText("Call ended").waitFor({ timeout: 8000 });

  step("Ezgi is gone from Max's Recent and listed under Blocked people");
  await max.goto(BASE);
  if (await max.getByRole("button", { name: "Call Ezgi" }).count()) throw new Error("still in Recent");
  await max.goto(BASE + "/profile");
  await max.getByRole("heading", { name: "Blocked people" }).waitFor();

  step("Ezgi taps Max later: told he isn't available");
  await ezgi.goto(BASE);
  await ezgi.getByRole("button", { name: "Call Max" }).click();
  await ezgi.waitForURL(new RegExp(`/r/${pair}$`));
  await ezgi.getByRole("button", { name: /join with video/i }).click();
  await ezgi.getByText("This person isn't available right now.").waitFor({ timeout: 10000 });

  step("Max unblocks her: she can reach their room again");
  await max.getByRole("button", { name: "Unblock" }).click();
  await max.waitForTimeout(500);
  await ezgi.goto(BASE + `/r/${pair}`);
  await ezgi.getByRole("button", { name: /join with video/i }).click();
  await ezgi.getByText(/waiting for them/i).waitFor({ timeout: 10000 });
  console.log("\nBLOCK E2E PASSED");
} catch (err) {
  console.log("\nBLOCK E2E FAILED:", err.message);
  await max.screenshot({ path: "test/out/block-fail-max.png" }).catch(() => {});
  await ezgi.screenshot({ path: "test/out/block-fail-ezgi.png" }).catch(() => {});
  process.exitCode = 1;
} finally {
  await bA.close(); await bB.close();
}
