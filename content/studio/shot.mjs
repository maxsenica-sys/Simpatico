// Screenshot helper: write HTML to a temp file (fonts need a file:// page) and capture it.
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
const { chromium } = createRequire(import.meta.url)("playwright");
let browser;
const tmp = path.join(os.tmpdir(), "simpatico-studio"); mkdirSync(tmp, { recursive: true });
let seq = 0;
export async function open(html, w, h) {
  browser ||= await chromium.launch();
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const f = path.join(tmp, `p${process.pid}-${seq++}.html`);
  writeFileSync(f, html);
  await page.goto("file://" + f);
  await page.evaluate(() => document.fonts.ready);
  return page;
}
export async function shot(html, w, h, out) {
  const page = await open(html, w, h);
  await page.screenshot({ path: out, type: out.endsWith(".jpg") ? "jpeg" : "png", ...(out.endsWith(".jpg") ? { quality: 92 } : {}) });
  await page.close();
}
export const done = async () => { await browser?.close(); browser = null; };
export function readQueue(file) {
  return import("node:fs").then(({ readFileSync }) => {
    const text = readFileSync(file, "utf8"); const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (ch !== "\r") cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const [head, ...body] = rows;
    return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
  });
}
