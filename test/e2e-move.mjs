// End-to-end: moving everything to a new Home Screen icon (separate storage, like iPhone).
// Old install: Me > Copy everything. New install: Me > Paste my data > Bring it here.
// Usage: BASE=http://localhost:3000 node test/e2e-move.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "http://localhost:3000";
const step = (s) => console.log("•", s);
const b = await chromium.launch();
const opts = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "en-AU", permissions: ["clipboard-read", "clipboard-write"] };
const oldApp = await (await b.newContext(opts)).newPage();
const newApp = await (await b.newContext(opts)).newPage();
try {
  step("Old icon has a profile, saved words, photo, call card, Recent with a shared room, settings");
  await oldApp.goto(BASE);
  const before = await oldApp.evaluate(() => {
    localStorage.setItem("talk.name", "Max");
    localStorage.setItem("talk.gender", "m");
    localStorage.setItem("talk.profile.v1", JSON.stringify({ name: "Max", gender: "m", from: "AU", words: ["Mia", "Ezgi", "Kadıköy"], topics: ["sport"] }));
    localStorage.setItem("talk.photo", "data:image/jpeg;base64," + "A".repeat(20000));
    localStorage.setItem("talk.mylink", "maxcard234");
    localStorage.setItem("talk.me", "0123456789abcdef0123456789abcdef");
    localStorage.setItem("talk.peer.pairroom77", "seat-max-pair-0001");
    localStorage.setItem("talk.recent.v1", JSON.stringify([{ name: "Ezgi", lang: "tr", at: Date.now(), calls: 12, seconds: 9000, pair: "pairroom77" }]));
    localStorage.setItem("talk.captions.v1", JSON.stringify({ size: 2, style: "instant" }));
    localStorage.setItem("talk.mediaOk", "1");
    return Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith("talk.") && k !== "talk.mediaOk").map((k) => [k, localStorage.getItem(k)]));
  });
  await oldApp.goto(BASE + "/profile");
  await oldApp.getByRole("button", { name: "Copy everything" }).click();
  await oldApp.getByText(/^Copied\. Now open Simpatico/).waitFor();
  const code = await oldApp.evaluate(() => navigator.clipboard.readText());
  console.log(`  copied ${Math.round(code.length / 1024)} KB`);

  step("New icon starts empty; home offers to bring data; paste, check, bring it here");
  await newApp.goto(BASE);
  await newApp.getByRole("link", { name: /Bring your data/ }).click();
  await newApp.waitForURL(/\/profile#move$/);
  await newApp.evaluate((c) => navigator.clipboard.writeText(c), code);
  await newApp.getByRole("button", { name: "Paste my data" }).click();
  await newApp.waitForURL((u) => u.pathname === "/");
  const after = await newApp.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith("talk.")).map((k) => [k, localStorage.getItem(k)])));
  const missing = Object.keys(before).filter((k) => after[k] !== before[k]);
  if (missing.length) throw new Error(`not moved: ${missing.join(", ")}`);
  console.log(`  all ${Object.keys(before).length} items identical on the new icon`);

  step("Straight to home on the new icon: Ezgi in Recent");
  await newApp.getByRole("button", { name: "Call Ezgi" }).waitFor();

  step("Rubbish pasted: a calm message, nothing changed");
  await newApp.goto(BASE + "/profile#move");
  await newApp.evaluate(() => navigator.clipboard.writeText("hello there"));
  await newApp.getByRole("button", { name: "Paste my data" }).click();
  await newApp.getByText(/doesn't look like Simpatico data/).waitFor();
  console.log("\nMOVE E2E PASSED");
} catch (err) {
  console.log("\nMOVE E2E FAILED:", err.message);
  await newApp.screenshot({ path: "test/out/move-fail.png" }).catch(() => {});
  process.exitCode = 1;
} finally {
  await b.close();
}
