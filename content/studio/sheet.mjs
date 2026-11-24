// Contact sheet of the cast: node content/studio/sheet.mjs out.png [who...]
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { figure, CAST, C } from "./cast.mjs";
import { POSES } from "./poses.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");
const out = process.argv[2];
const only = process.argv.slice(3);
const names = Object.keys(POSES).filter((n) => !only.length || only.some((o) => n.startsWith(o)));
const cols = 6, cw = 360, ch = 500;
const rows = Math.ceil(names.length / cols);
const bgs = [C.ink, C.blue, C.mint];
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cw}" height="${rows * ch}" viewBox="0 0 ${cols * cw} ${rows * ch}"><rect width="100%" height="100%" fill="#22262c"/>`;
names.forEach((n, i) => {
  const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
  svg += `<rect x="${x + 6}" y="${y + 6}" width="${cw - 12}" height="${ch - 12}" rx="18" fill="${bgs[i % 3]}"/>`;
  svg += POSES[n]({ x: x + cw / 2, y: y + ch - 50, scale: n.includes("family") || n.includes("two-people") || n.includes("friends") ? 0.5 : 0.7 });
  svg += `<text x="${x + cw / 2}" y="${y + ch - 16}" text-anchor="middle" font-family="sans-serif" font-size="17" font-weight="700" fill="${C.dark}">${n}</text>`;
});
svg += "</svg>";
writeFileSync(out.replace(/\.png$/, ".svg"), svg);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: cols * cw, height: rows * ch } });
await p.setContent(`<body style="margin:0">${svg}</body>`); await p.screenshot({ path: out }); await b.close();
