// Renders the carousels and stills from content/queue.csv into content/out/<post>/.
//   node content/studio/render.mjs [post ids...]      (--part i/n splits the work for parallel runs)
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { frame, page, SIZE } from "./slides.mjs";
import { open, done, readQueue } from "./shot.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
export const OUT = path.resolve(here, "../out");
export const folder = (p) => path.join(OUT, `${p.post_id}_${p.format}_${p.feature_id}`);
export function writeText(p) {
  const dir = folder(p); mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "instagram.txt"), `${p.caption}\n\n${p.hashtags}\n`);
  writeFileSync(path.join(dir, "tiktok.txt"), `${p.tiktok_caption}\n\nSound: ${p.tiktok_sound}\n`);
  return dir;
}
async function snap(html, fmt, file) {
  const { W, H } = SIZE[fmt];
  const pg = await open(html, W, H);
  await pg.screenshot({ path: file });
  await pg.close();
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const part = args.includes("--part") ? args[args.indexOf("--part") + 1].split("/").map(Number) : null;
  const ids = args.filter((a) => /^S\d+$/.test(a));
  let q = (await readQueue(path.resolve(here, "../queue.csv"))).filter((p) => p.format !== "reel" && (!ids.length || ids.includes(p.post_id)));
  if (part) q = q.filter((_, i) => i % part[1] === part[0]);
  for (const p of q) {
    const dir = writeText(p);
    if (p.format === "carousel") {
      for (const fmt of ["ig", "tt"]) {
        const sub = path.join(dir, fmt === "ig" ? "instagram" : "tiktok"); mkdirSync(sub, { recursive: true });
        for (let b = 0; b < 6; b++) await snap(page(frame(p, b, { fmt, hook: fmt === "tt" ? p.tiktok_hook : undefined })), fmt, path.join(sub, `slide-${b + 1}.png`));
      }
    } else {
      await snap(page(frame(p, "still", { fmt: "ig" })), "ig", path.join(dir, "instagram.png"));
      await snap(page(frame(p, "still", { fmt: "tt", hook: p.tiktok_hook })), "tt", path.join(dir, "tiktok.png"));
    }
    console.log(p.post_id, p.format);
  }
  await done();
}
