// End-to-end: In person. One phone, two people: Home → In person → "Let them talk first" →
// their language is worked out from what they say → each half shows the other person's words
// translated, plus your own; their half is upside down. Flip and End.
// Usage: BASE=http://localhost:3000 node test/e2e-inperson.mjs (server wired to test/mock-soniox.ts,
// whose second, fourth… sentences are "Spanish" when language identification is on)
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE ?? "http://localhost:3000";
const step = (s) => console.log("•", s);
const out = (f) => fileURLToPath(new URL(`./out/${f}`, import.meta.url));
const wav = fileURLToPath(new URL("./speech.wav", import.meta.url));
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wav}`, "--autoplay-policy=no-user-gesture-required"] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "en-AU", permissions: ["microphone"] })).newPage();
const errors = [];
page.on("pageerror", (e) => {
  errors.push(e.message);
  console.log("  page error:", e.message);
});

try {
  step("Home: Start a call, then Group call and In person side by side; the call card is a slim row");
  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.setItem("talk.name", "Max");
    localStorage.setItem("talk.gender", "m");
  });
  await page.reload();
  await page.getByRole("button", { name: /In person/ }).waitFor();
  await page.locator(".card-row").waitFor();
  await page.screenshot({ path: out("inperson-0-home.png") });

  step("In person: 'Let them talk first' is the default; Start");
  await page.getByRole("button", { name: /In person/ }).click();
  await page.waitForURL(/\/talk$/);
  await page.getByText("Talk face to face").waitFor();
  await page.screenshot({ path: out("inperson-1-setup.png") });
  await page.getByRole("button", { name: "Start" }).click();
  await page.locator(".ip-live").waitFor({ timeout: 10000 });

  step("My words show on my half; their language is worked out (Spanish) from what they say");
  await page.waitForFunction(() => /You said/.test(document.querySelector(".ip-half.me .ip-own")?.textContent ?? ""), null, { timeout: 15000 });
  await page.waitForFunction(() => /Español/.test(document.querySelector(".ip-half.them .ip-lang")?.textContent ?? ""), null, { timeout: 20000 });

  step("Each half shows the other person's words translated: theirs on mine (English), mine on theirs (Spanish)");
  await page.waitForFunction(() => document.querySelector(".ip-half.me .cap")?.textContent.includes("✨") || document.querySelector(".ip-half.me .cap")?.textContent.length > 3, null, { timeout: 20000 });
  await page.waitForFunction(() => document.querySelector(".ip-half.them .cap")?.textContent.length > 3, null, { timeout: 20000 });
  const halves = await page.evaluate(() => ({
    mine: document.querySelector(".ip-half.me .cap")?.textContent,
    theirs: document.querySelector(".ip-half.them .cap")?.textContent,
    theirOwn: document.querySelector(".ip-half.them .ip-own")?.textContent,
    theirLabel: document.querySelector(".ip-half.them .ip-head")?.textContent,
    rotated: getComputedStyle(document.querySelector(".ip-half.them")).transform,
  }));
  console.log("  my half:", halves.mine, "\n  their half:", halves.theirs, "\n  their own words:", halves.theirOwn, "\n  their label:", halves.theirLabel);
  if (!/es~/.test(halves.theirOwn ?? "")) throw new Error("their half should show their own (Spanish) words");
  if (!/Dijiste/.test(halves.theirOwn ?? "")) throw new Error("their half should be labelled in Spanish");
  if (halves.rotated === "none") throw new Error("their half should be upside down");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out("inperson-2-live.png") });

  step("Text keeps well clear of the screen edges (28 px), in a panel on each half");
  const edges = await page.evaluate(() => [...document.querySelectorAll(".ip-caps")].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(innerWidth - r.right)]; }));
  if (edges.some(([l, r]) => l < 28 || r < 28)) throw new Error("caption panels too close to the edges: " + JSON.stringify(edges));

  step("Their language button: the list opens on their half, in their language; pick Türkçe");
  await page.locator(".ip-half.them .ip-lang").click();
  await page.locator(".ip-half.them .ip-langs").waitFor();
  const head = await page.locator(".ip-half.them .ip-langs-head b").textContent();
  if (head !== "Tu idioma") throw new Error("their list should be titled in Spanish, got " + head);
  await page.locator(".ip-half.them .ip-lang-item", { hasText: "Türkçe" }).click();
  await page.waitForFunction(() => /Türkçe/.test(document.querySelector(".ip-half.them .ip-lang")?.textContent ?? ""));
  await page.waitForFunction(() => /Senin için|Söylediğin|Kendi dilinde/.test(document.querySelector(".ip-half.them")?.textContent ?? ""), null, { timeout: 5000 }).catch(() => {});

  step("Flip, then change their language again: still works, no errors");
  await page.getByRole("button", { name: "Flip" }).click();
  await page.locator(".ip-half.them .ip-lang").click();
  await page.locator(".ip-half.them .ip-lang-item", { hasText: "Español" }).click();
  await page.waitForFunction(() => /Español/.test(document.querySelector(".ip-half.them .ip-lang")?.textContent ?? ""));
  await page.getByRole("button", { name: "Flip" }).click();

  step("My language button: change mine (Français), then back to English");
  await page.locator(".ip-half.me .ip-lang").click();
  await page.locator(".ip-half.me .ip-lang-item", { hasText: "Français" }).click();
  await page.waitForFunction(() => /Français/.test(document.querySelector(".ip-half.me .ip-lang")?.textContent ?? ""));
  await page.locator(".ip-half.me .ip-lang").click();
  await page.locator(".ip-half.me .ip-lang-item", { hasText: "English" }).first().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: out("inperson-3-after-changes.png") });
  if (errors.length) throw new Error("page errors: " + errors.join("; "));

  step("Flip turns the whole screen round; End goes home");
  await page.getByRole("button", { name: "Flip" }).click();
  if (!(await page.locator(".ip-live.flipped").count())) throw new Error("flip should turn the screen round");
  await page.getByRole("button", { name: "End" }).click();
  await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 5000 });

  console.log("\nIN PERSON E2E PASSED");
  process.exit(0);
} catch (e) {
  console.error("\nIN PERSON E2E FAILED:", e.message);
  await page.screenshot({ path: out("inperson-fail.png") }).catch(() => {});
  process.exit(1);
}
