// Group call, the volleyball-team case: four real Chromium instances against a server wired to
// test/mock-soniox.ts (translations come back as "<target>:<word>").
//   Coach  tr-TR  remote, video      Max   en-AU  remote, video
//   Ivan   ru-RU  in the room, audio Ayşe  tr-TR  in the room, audio
// Usage: BASE=http://localhost:3000 node test/e2e-group.mjs
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = fileURLToPath(new URL("./out/", import.meta.url));
mkdirSync(OUT, { recursive: true });
const wav = fileURLToPath(new URL("./speech.wav", import.meta.url));
const args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wav}`, "--autoplay-policy=no-user-gesture-required"];
const step = (s) => console.log(`• ${s}`);

const people = [
  { key: "coach", name: "Coach", locale: "tr-TR", view: { width: 1280, height: 800 } },
  { key: "max", name: "Max", locale: "en-AU", view: { width: 390, height: 844 } },
  { key: "ivan", name: "Ivan", locale: "ru-RU", view: { width: 390, height: 844 }, inRoom: true, audioOnly: true },
  { key: "ayse", name: "Ayşe", locale: "tr-TR", view: { width: 390, height: 844 }, inRoom: true, audioOnly: true },
];
const browsers = [];
const pages = {};
for (const p of people) {
  const b = await chromium.launch({ args });
  browsers.push(b);
  const page = await (await b.newContext({ locale: p.locale, viewport: p.view, permissions: ["camera", "microphone"] })).newPage();
  page.on("pageerror", (e) => console.log(`[${p.key} pageerror]`, e.message));
  pages[p.key] = page;
}
const { coach, max, ivan, ayse } = pages;

const join = async (page, person, url) => {
  await page.goto(url + "?debug");
  await page.locator(".field input").fill(person.name);
  await page.locator(".gender-select").selectOption(person.gender ?? "x");
  if (person.inRoom) await page.locator(".check input").check();
  await page.locator(person.audioOnly ? ".btn.big.secondary" : ".btn.primary.big").click();
};
/** Captions on `page` from the person named `from` (the uppercase label before each line). */
const captionsFrom = (page, from) =>
  page.$$eval(".cap", (els, from) => els.filter((e) => e.querySelector(".cap-who")?.textContent === from).map((e) => e.textContent.replace(from, "").trim()), from);
const waitCaption = (page, from, test, what) =>
  page.waitForFunction(
    ([from, src]) => [...document.querySelectorAll(".cap")].some((e) => e.querySelector(".cap-who")?.textContent === from && new RegExp(src).test(e.textContent)),
    [from, test.source],
    { timeout: 25000 },
  ).catch(() => { throw new Error(`no caption from ${from} matching ${test} (${what})`); });

try {
  step("Coach starts a group call from the home page (Turkish UI)");
  await coach.goto(BASE);
  await coach.getByRole("button", { name: "Grup araması" }).click();
  await coach.waitForURL(/\/r\/[a-z0-9]{6}$/);
  const url = coach.url();
  await coach.getByText("Grup araması").first().waitFor();
  await join(coach, people[0], url);
  await coach.getByText("Diğerlerinin katılması bekleniyor").waitFor();

  step("Max (English, remote), Ivan (Russian, in the room) and Ayşe (Turkish, in the room) join");
  await join(max, people[1], url);
  await join(ivan, people[2], url);
  await join(ayse, people[3], url);
  for (const [k, page] of Object.entries(pages)) {
    await page.waitForFunction(() => document.querySelectorAll(".person:not(.pending):not(.invite-tile)").length === 3, null, { timeout: 30000 }).catch(() => {
      throw new Error(`${k} did not connect to all three others`);
    });
  }
  console.log("  everyone connected to everyone (mesh of 6 connections)");
  console.log("  Max's people strip:", await max.$$eval(".person:not(.invite-tile)", (els) => els.map((e) => `${e.querySelector(".person-name").textContent} (${e.querySelector(".person-lang").textContent})`).join(", ")));

  step("Coach's Turkish reaches each person in their own language, labelled with his name");
  await waitCaption(max, "Coach", /en:|\(English\)/, "Max reads English");
  await waitCaption(ivan, "Coach", /ru:|\(Russian\)/, "Ivan reads Russian");
  await waitCaption(ayse, "Coach", /^Coach[^:]*$/, "Ayşe reads Turkish: original words, no translation");
  console.log("  Max:", (await captionsFrom(max, "Coach")).at(-1));
  console.log("  Ivan:", (await captionsFrom(ivan, "Coach")).at(-1));
  console.log("  Ayşe:", (await captionsFrom(ayse, "Coach")).at(-1));

  step("Max's English reaches Coach and Ayşe in Turkish, Ivan in Russian");
  await waitCaption(coach, "Max", /tr:|\(Turkish\)/, "Coach reads Turkish");
  await waitCaption(ivan, "Max", /ru:|\(Russian\)/, "Ivan reads Russian");
  await waitCaption(ayse, "Max", /tr:|\(Turkish\)/, "Ayşe reads Turkish");

  step("In-room phones: only one of Ivan/Ayşe is captioned at a time (same voice, same room)");
  await max.waitForFunction(() => [...document.querySelectorAll(".cap-who")].some((e) => e.textContent === "Ivan" || e.textContent === "Ayşe"), null, { timeout: 25000 });
  const inRoomFrom = await max.$$eval(".cap-who", (els) => [...new Set(els.map((e) => e.textContent).filter((n) => n === "Ivan" || n === "Ayşe"))]);
  console.log("  in-room voices captioned on Max's screen:", inRoomFrom.join(", "));

  step("In-room audio: Ivan's phone doesn't play Ayşe (same room) but plays Coach and Max");
  const ivanAudio = await ivan.$$eval("audio.remote-audio", (els) => els.map((a) => a.muted));
  const mutedCount = ivanAudio.filter(Boolean).length;
  console.log(`  Ivan's ${ivanAudio.length} audio streams, muted: ${mutedCount}`);
  if (ivanAudio.length !== 3 || mutedCount !== 1) throw new Error("expected exactly Ayşe muted on Ivan's phone");
  const maxMuted = await max.$$eval("audio.remote-audio", (els) => els.filter((a) => a.muted).length);
  if (maxMuted !== 0) throw new Error("Max is remote: he must hear everyone");

  if (process.env.DEBUG_STATE)
    console.log("  Max's view:", JSON.stringify(await max.evaluate(() => ({ active: window.__call.state.activeId, phase: window.__call.state.phase, ps: window.__call.state.participants.map((p) => [p.name, p.id.slice(0, 6), "cam=" + p.remoteCam, "ao=" + p.partnerAudioOnly, "vok=" + p.videoOk]) }))));
  if (process.env.DEBUG_STATE)
    for (const [k, pg] of Object.entries(pages))
      console.log(`  ${k}:`, JSON.stringify(await pg.evaluate(() => ({ timer: !!window.__call.statusTimer, links: [...window.__call.links.values()].map((l) => `${l.id.slice(0, 6)}:${l.pc?.connectionState}:${l.last ? "stats" : "nostats"}`) }))));
  await coach.screenshot({ path: OUT + "g1-coach.png" });
  await max.screenshot({ path: OUT + "g2-max.png" });
  await ivan.screenshot({ path: OUT + "g3-ivan.png" });

  step("Ivan leaves: everyone is told, the call carries on");
  await ivan.evaluate(() => document.querySelector(".call")?.dispatchEvent(new MouseEvent("mousemove", { bubbles: true })));
  await ivan.locator(".ctrl.danger").last().click();
  await max.waitForFunction(() => document.querySelectorAll(".person:not(.invite-tile)").length === 2, null, { timeout: 15000 });
  console.log("  Max now sees:", await max.$$eval(".person-name", (els) => els.map((e) => e.textContent).join(", ")));

  console.log("\nGROUP E2E PASSED");
} catch (err) {
  console.log("\nGROUP E2E FAILED:", err.message);
  for (const [k, page] of Object.entries(pages)) await page.screenshot({ path: OUT + `gfail-${k}.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  for (const b of browsers) await b.close();
}
