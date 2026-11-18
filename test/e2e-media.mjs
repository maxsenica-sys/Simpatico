// End-to-end: photos and videos in a call's messages. Max sends a (big) photo and a short video
// from the Text sheet; Ezgi is told, sees a count on Text, opens them. Uploads need the sender's
// own key, odd file types are refused, and everything is deleted when the call ends.
// Usage: BASE=http://localhost:3000 node test/e2e-media.mjs (server wired to test/mock-soniox.ts)
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE ?? "http://localhost:3000";
const step = (s) => console.log("•", s);
const fixture = (f) => fileURLToPath(new URL(`./fixtures/${f}`, import.meta.url));
const args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"];
const opts = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["camera", "microphone"], locale: "en-AU" };
const max = await (await (await chromium.launch({ args })).newContext(opts)).newPage();
const ezgi = await (await (await chromium.launch({ args })).newContext(opts)).newPage();
for (const p of [max, ezgi]) p.on("pageerror", (e) => console.log("  page error:", e.message));
const setup = ([name, g]) => {
  localStorage.setItem("talk.name", name);
  localStorage.setItem("talk.gender", g);
  localStorage.setItem("talk.mediaOk", "1");
};

try {
  step("Max and Ezgi are in a call");
  await max.goto(BASE);
  await max.evaluate(setup, ["Max", "m"]);
  await ezgi.goto(BASE);
  await ezgi.evaluate(setup, ["Ezgi", "f"]);
  await max.reload();
  await max.getByRole("button", { name: /start a call/i }).click();
  await max.waitForURL(/\/r\/[a-z0-9]{6}$/);
  const url = max.url();
  const room = url.split("/").pop();
  await max.getByRole("button", { name: /join audio only/i }).click();
  await ezgi.goto(url);
  await ezgi.getByRole("button", { name: /join audio only/i }).click();
  await max.waitForFunction(() => document.querySelector(".no-video .stage-name, .stage-name"), null, { timeout: 20000 });
  await max.waitForTimeout(1500);

  step("Max sends a photo from the Text sheet: made smaller on his phone, shown to him straight away");
  await max.getByRole("button", { name: "Open chat" }).first().click();
  await max.locator('.sheet input[type="file"]').setInputFiles(fixture("photo.png"));
  await max.waitForFunction(() => { const i = document.querySelector(".tline.me .media-thumb img"); return i && i.naturalWidth > 0; }, null, { timeout: 15000 });
  await max.waitForFunction(() => !document.querySelector(".media-status"), null, { timeout: 15000 });

  step("Ezgi is told, with a count on Text");
  await ezgi.getByText("Max sent a photo or video").waitFor({ timeout: 10000 });
  const badge = await ezgi.locator(".ctrl .badge").textContent();
  if (badge !== "1") throw new Error("badge should be 1, got " + badge);
  await ezgi.screenshot({ path: fileURLToPath(new URL("./out/media-1-told.png", import.meta.url)) });

  step("Max sends a short video");
  await max.locator('.sheet input[type="file"]').setInputFiles(fixture("clip.mp4"));
  await max.waitForFunction(() => document.querySelectorAll(".tline.me .media-thumb").length === 2 && !document.querySelector(".media-status"), null, { timeout: 20000 });
  await ezgi.waitForFunction(() => document.querySelector(".ctrl .badge")?.textContent === "2", null, { timeout: 10000 });

  step("Ezgi opens the messages: the photo (1600 px, JPEG) and the video play; the count clears");
  await ezgi.getByRole("button", { name: "View" }).first().click().catch(() => ezgi.getByRole("button", { name: "Open chat" }).first().click());
  await ezgi.waitForFunction(() => { const i = document.querySelector(".tline.them .media-thumb img"); return i && i.naturalWidth > 0; }, null, { timeout: 15000 });
  const size = await ezgi.evaluate(() => { const i = document.querySelector(".tline.them .media-thumb img"); return [i.naturalWidth, i.naturalHeight]; });
  if (size[0] !== 1600) throw new Error("photo should arrive at 1600 px wide, got " + size);
  await ezgi.waitForFunction(() => { const v = document.querySelector(".tline.them .media-thumb video"); return v && v.readyState >= 1 && v.videoWidth === 320; }, null, { timeout: 15000 });
  if (await ezgi.locator(".ctrl .badge").count()) throw new Error("count should clear once the messages are open");
  await ezgi.locator(".tline.them .media-thumb").first().click();
  await ezgi.locator(".media-viewer img").waitFor();
  await ezgi.screenshot({ path: fileURLToPath(new URL("./out/media-2-viewer.png", import.meta.url)) });
  await ezgi.getByRole("button", { name: "Close" }).last().click();
  await ezgi.screenshot({ path: fileURLToPath(new URL("./out/media-3-messages.png", import.meta.url)) });
  console.log("  photo arrived at", size.join("×"));

  step("Videos stream in parts (Safari needs that), and nobody without the key can send");
  const link = await ezgi.evaluate(() => document.querySelector(".tline.them .media-thumb video").getAttribute("src").split("#")[0]);
  const part = await fetch(BASE + link, { headers: { Range: "bytes=0-99" } });
  if (part.status !== 206 || (await part.arrayBuffer()).byteLength !== 100) throw new Error("range request should return 100 bytes, got " + part.status);
  const forged = await fetch(`${BASE}/api/media/${room}`, { method: "POST", headers: { "Content-Type": "image/jpeg", "X-Peer": "someone-else", "X-Key": "nope" }, body: new Uint8Array(10) });
  if (forged.status !== 403) throw new Error("upload without the key should be refused, got " + forged.status);

  step("A file that isn't a photo or video: a clear message, nothing sent");
  await max.locator('.sheet input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await max.getByText("That kind of file can't be sent").waitFor({ timeout: 5000 });
  if ((await max.locator(".tline.me .media-thumb").count()) !== 2) throw new Error("nothing should be added for a text file");

  step("The call ends: the photo and the video are deleted with it");
  for (const p of [max, ezgi]) {
    if (await p.locator(".sheet").count()) await p.locator(".sheet .sheet-actions").getByRole("button", { name: "Close" }).click();
    await p.getByRole("button", { name: "End call" }).first().click();
  }
  await max.waitForTimeout(1500);
  const gone = await fetch(BASE + link);
  if (gone.status !== 404) throw new Error("media should be gone after the call, got " + gone.status);

  console.log("\nMEDIA E2E PASSED");
  process.exit(0);
} catch (e) {
  console.error("\nMEDIA E2E FAILED:", e.message);
  await max.screenshot({ path: fileURLToPath(new URL("./out/media-fail-max.png", import.meta.url)) }).catch(() => {});
  await ezgi.screenshot({ path: fileURLToPath(new URL("./out/media-fail-ezgi.png", import.meta.url)) }).catch(() => {});
  process.exit(1);
}
