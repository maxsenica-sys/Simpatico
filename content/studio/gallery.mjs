// Builds content/out/index.html: every post in posting order (the Instagram plan), with its
// pictures or video and the captions ready to copy. Open the file in a browser.
import { readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readQueue } from "./shot.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../out");
const q = Object.fromEntries((await readQueue(path.resolve(here, "../queue.csv"))).map((p) => [p.post_id, p]));
const ig = await readQueue(path.resolve(here, "../posting_plan_instagram.csv"));
const tt = await readQueue(path.resolve(here, "../posting_plan_tiktok.csv"));
const ttDay = Object.fromEntries(tt.map((r) => [r.post_id, `day ${r.day}, ${r.time}`]));
const dirs = Object.fromEntries(readdirSync(OUT).filter((d) => /^S\d+_/.test(d)).map((d) => [d.split("_")[0], d]));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
let html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Simpatico content</title><style>
body{margin:0;background:#0b0d10;color:#f4f5f7;font:16px/1.45 -apple-system,system-ui,sans-serif;padding:20px}
h1{font-size:26px}h2{margin:34px 0 10px;font-size:20px;color:#5fe0bd}
.post{background:#15181d;border-radius:18px;padding:16px;margin:12px 0}
.post h3{margin:0 0 4px;font-size:17px}.meta{color:#9aa3ad;font-size:14px;margin-bottom:10px}
.strip{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px}.strip img,.strip video{height:300px;border-radius:10px;flex:none}
pre{white-space:pre-wrap;background:#0b0d10;border-radius:10px;padding:10px 12px;font:14px/1.4 inherit;margin:8px 0 0;cursor:pointer}
pre:before{content:attr(data-l) "  (tap to copy)";display:block;color:#5b8cff;font-weight:700;font-size:12px;margin-bottom:3px}
</style><h1>Simpatico: ${Object.keys(dirs).length} posts, in posting order</h1><p class="meta">Each post has its own folder beside this file. Instagram files are 1080 x 1350 (reels 1080 x 1920); TikTok files are 1080 x 1920.</p>`;
let day = "";
for (const r of ig) {
  const p = q[r.post_id], d = dirs[r.post_id];
  if (!p || !d) continue;
  if (r.day !== day) { day = r.day; html += `<h2>Day ${r.day} · ${esc(r.week)}</h2>`; }
  let media = "";
  if (p.format === "carousel") media = [1, 2, 3, 4, 5, 6].map((i) => `<img loading="lazy" src="${d}/instagram/slide-${i}.png">`).join("") + [1, 2, 3, 4, 5, 6].map((i) => `<img loading="lazy" src="${d}/tiktok/slide-${i}.png">`).join("");
  else if (p.format === "still") media = `<img loading="lazy" src="${d}/instagram.png"><img loading="lazy" src="${d}/tiktok.png">`;
  else media = ["reel-instagram.mp4", "reel-tiktok.mp4"].filter((f) => existsSync(path.join(OUT, d, f))).map((f) => `<video controls muted preload="none" poster="" src="${d}/${f}"></video>`).join("");
  html += `<div class="post"><h3>${r.post_id} · ${p.format} · ${esc(p.hook)}</h3><div class="meta">Instagram: day ${r.day}, ${r.slot}${ttDay[r.post_id] ? ` · TikTok: ${ttDay[r.post_id]}` : ""} · folder ${d}</div><div class="strip">${media}</div>
<pre data-l="Instagram caption">${esc(p.caption)}\n\n${esc(p.hashtags)}</pre><pre data-l="TikTok caption (sound: ${esc(p.tiktok_sound)})">${esc(p.tiktok_caption)}</pre>${p.format === "reel" ? `<pre data-l="Voiceover to record">${esc(p.voiceover_script)}</pre>` : ""}</div>`;
}
html += `<script>document.querySelectorAll('pre').forEach(p=>p.onclick=()=>navigator.clipboard.writeText(p.textContent))</script>`;
writeFileSync(path.join(OUT, "index.html"), html);
console.log("wrote", path.join(OUT, "index.html"));
