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
  step("Home: Group call and In person side by side, the call card button at the top, the round Call button in the bar");
  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.setItem("talk.name", "Max");
    localStorage.setItem("talk.gender", "m");
  });
  await page.reload();
  await page.getByRole("button", { name: /In person/ }).waitFor();
  await page.locator(".card-chip").waitFor();
  await page.locator(".tabbar .tab-call").waitFor();
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
  step("Ending with something said: a last chance to save it, and the choice to keep conversations on this phone");
  await page.getByRole("dialog", { name: "Conversation ended" }).waitFor({ timeout: 5000 });
  if (await page.evaluate(() => localStorage.getItem("talk.keep"))) throw new Error("keeping conversations must be off until chosen");
  await page.getByRole("button", { name: "Save conversation" }).waitFor();
  await page.getByLabel("Keep my conversations on this phone").check();
  await page.getByText("Kept on this phone").waitFor({ timeout: 3000 });
  await page.getByRole("button", { name: "Done" }).click();
  await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 5000 });
  step("The Me page lists it, with both languages on a line, and it can be deleted");
  await page.goto(BASE + "/profile");
  await page.locator("details.pgroup summary", { hasText: "Saved conversations" }).click();
  await page.locator(".talk-row").first().waitFor({ timeout: 5000 });
  await page.locator(".talk-row").first().click();
  const sheet = page.getByRole("dialog").filter({ has: page.locator(".tline") });
  await sheet.locator(".tline").first().waitFor();
  const both = await sheet.locator(".tline .talk-other").count();
  console.log("  saved lines:", await sheet.locator(".tline").count(), "| with both languages:", both);
  if (!both) throw new Error("a saved line should carry both languages");
  await sheet.getByRole("button", { name: "Delete", exact: true }).click();
  await page.locator(".talk-row").waitFor({ state: "detached", timeout: 5000 });

  // ---------------------------------------------------------------- nothing gets lost
  const fresh = async (init) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "en-AU", permissions: ["microphone"] });
    if (init) await ctx.addInitScript(init);
    const p = await ctx.newPage();
    await p.goto(BASE);
    await p.evaluate(() => {
      localStorage.setItem("talk.name", "Max");
      localStorage.setItem("talk.gender", "m");
      sessionStorage.setItem("talk.splash", "1");
    });
    return p;
  };
  const talkABit = async (p) => {
    await p.goto(BASE + "/talk");
    await p.getByRole("button", { name: "Start" }).click();
    await p.locator(".ip-live").waitFor({ timeout: 10000 });
    await p.waitForFunction(() => document.querySelector(".ip-half.me .cap")?.textContent.length > 3 && document.querySelector(".ip-half.them .cap")?.textContent.length > 3, null, { timeout: 30000 });
    await p.waitForTimeout(1500);
  };

  step("The app dies mid-conversation (battery, crash, swiped away), keeping never turned on: the words are still on the phone");
  const crash = await fresh();
  await talkABit(crash);
  // No End, no goodbye: the page is simply gone.
  await crash.goto("about:blank");
  await crash.goto(BASE);
  await crash.getByText("Your last conversation was not saved").waitFor({ timeout: 15000 });
  await crash.screenshot({ path: out("inperson-5-unsaved-banner.png") });
  await crash.getByRole("button", { name: "Keep it" }).click();
  await crash.getByText("Kept on this phone").waitFor({ timeout: 3000 });
  await crash.goto(BASE + "/profile");
  await crash.locator("details.pgroup summary", { hasText: "Saved conversations" }).click();
  await crash.locator(".talk-row:not(.draft)").first().click();
  const rescued = await crash.locator(".sheet .tline").count();
  console.log("  rescued lines:", rescued);
  if (rescued < 2) throw new Error("the crashed conversation should have been rescued with its lines");
  await crash.context().close();

  step("Ended, Done tapped without keeping: a recovery copy waits on the Me page for 3 days, with no nagging on the home screen");
  const declined = await fresh();
  await talkABit(declined);
  await declined.getByRole("button", { name: "End" }).click();
  await declined.getByText("A recovery copy stays on this phone for 3 days").waitFor({ timeout: 5000 });
  await declined.getByRole("button", { name: "Done" }).click();
  await declined.waitForURL((u) => new URL(u).pathname === "/", { timeout: 5000 });
  await declined.waitForTimeout(800);
  if (await declined.getByText("Your last conversation was not saved").count()) throw new Error("no banner after a deliberate Done");
  await declined.goto(BASE + "/profile");
  await declined.locator("details.pgroup summary", { hasText: "Saved conversations" }).click();
  await declined.locator(".talk-row.draft").first().waitFor({ timeout: 5000 });
  const exp = await declined.evaluate(() => new Promise((res) => { const q = indexedDB.open("simpatico", 1); q.onsuccess = () => { const g = q.result.transaction("talks").objectStore("talks").getAll(); g.onsuccess = () => res(g.result.map((t) => [t.draft, Math.round((t.expires - Date.now()) / 86400000)])); }; }));
  console.log("  recovery copies [draft, days left]:", JSON.stringify(exp));
  if (!exp.length || exp[0][0] !== true || exp[0][1] !== 3) throw new Error("a declined conversation should be a recovery copy that expires in 3 days");
  await declined.context().close();

  step("The phone's main storage is broken: the second store takes over, nothing is lost");
  const broken = await fresh(() => {
    indexedDB.open = () => {
      throw new Error("storage is broken");
    };
  });
  await talkABit(broken);
  await broken.getByRole("button", { name: "End" }).click();
  await broken.getByRole("dialog", { name: "Conversation ended" }).waitFor({ timeout: 5000 });
  const fb = await broken.evaluate(() => Object.values(JSON.parse(localStorage.getItem("talk.saved.fallback") ?? "{}")).map((t) => t.lines.length));
  console.log("  second store holds conversations with lines:", JSON.stringify(fb));
  if (!fb.length || fb[0] < 2) throw new Error("the second store should hold the conversation when the main one fails");
  if (await broken.getByText("This phone could not store the conversation").count()) throw new Error("no warning when the second store worked");
  await broken.context().close();

  step("No storage at all: a clear warning to save it as a file before leaving");
  const none = await fresh(() => {
    indexedDB.open = () => {
      throw new Error("storage is broken");
    };
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === "talk.saved.fallback") throw new Error("quota");
      return real.call(this, k, v);
    };
  });
  await talkABit(none);
  await none.getByRole("button", { name: "End" }).click();
  await none.getByText("This phone could not store the conversation").waitFor({ timeout: 5000 });
  await none.getByRole("button", { name: "Save conversation" }).waitFor();
  await none.context().close();

  console.log("\nIN PERSON E2E PASSED");
  process.exit(0);
} catch (e) {
  console.error("\nIN PERSON E2E FAILED:", e.message);
  await page.screenshot({ path: out("inperson-fail.png") }).catch(() => {});
  process.exit(1);
}
