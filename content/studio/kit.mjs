// Shared pieces: fonts, the logo, character helpers.
import { fileURLToPath } from "node:url";
import path from "node:path";
import { figure, CAST, C } from "./cast.mjs";
import { POSES } from "./poses.mjs";
export { C };
const here = path.dirname(fileURLToPath(import.meta.url));
const NUNITO = path.resolve(here, "../../public/fonts");
const NOTO = path.resolve(here, "fonts/node_modules/@fontsource");
const RANGES = {
  "cyrillic-ext": "U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F",
  cyrillic: "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116",
  vietnamese: "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB",
  "latin-ext": "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
  latin: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
};
const nunito = Object.entries(RANGES).flatMap(([sub, range]) => [400, 600, 700, 800].map((w) =>
  `@font-face{font-family:Nunito;font-weight:${w};src:url(file://${NUNITO}/nunito-${sub}-${w}-normal.woff2) format('woff2');unicode-range:${range}}`)).join("");
const noto = ["noto-sans", "noto-sans-arabic", "noto-sans-devanagari", "noto-sans-gurmukhi", "noto-sans-thai", "noto-sans-kr", "noto-sans-jp", "noto-sans-sc"]
  .flatMap((f) => [400, 700].map((w) => `<link rel="stylesheet" href="file://${NOTO}/${f}/${w}.css">`)).join("");
/** Everything a page needs in <head>. Pages must be opened from a file:// address for the fonts to load. */
export const HEAD = `<meta charset="utf-8">${noto}<style>${nunito}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#22262c}
body{font-family:Nunito,'Noto Sans',sans-serif;color:${C.dark};-webkit-font-smoothing:antialiased}
.f-ar{font-family:'Noto Sans Arabic',Nunito,sans-serif}.f-hi{font-family:'Noto Sans Devanagari',Nunito,sans-serif}
.f-pa{font-family:'Noto Sans Gurmukhi',Nunito,sans-serif}.f-th{font-family:'Noto Sans Thai',Nunito,sans-serif}
.f-ko{font-family:'Noto Sans KR',Nunito,sans-serif}.f-ja{font-family:'Noto Sans JP',Nunito,sans-serif}
.f-zh{font-family:'Noto Sans SC',Nunito,sans-serif}.f-el{font-family:'Noto Sans',Nunito,sans-serif}
</style>`;

export const BUBBLE_L = "M17 7h3c7.2 0 13 5.4 13 12s-5.8 12-13 12h-2.5l-6.5 5.5V30A12 12 0 0 1 4 19C4 12.4 9.8 7 17 7z";
export const BUBBLE_R = "M28 15h3c7.2 0 13 5.4 13 12a12 12 0 0 1-7 10.9v5.6L30.5 39H28c-7.2 0-13-5.4-13-12s5.8-12 13-12z";
export const mark = (size, cls = "") => `<svg class="mark ${cls}" viewBox="0 0 48 48" width="${size}" height="${size}"><g class="bl"><path d="${BUBBLE_L}" fill="${C.blue}"/></g><g class="br"><path d="${BUBBLE_R}" fill="${C.mint}" fill-opacity=".9"/></g></svg>`;
/** The lockup: mark and name in a dark pill, so it reads on every background. */
export const lockup = (h = 64) => `<div class="lockup" style="height:${h}px;padding:0 ${h * 0.36}px 0 ${h * 0.24}px;border-radius:${h / 2}px;font-size:${h * 0.46}px">${mark(h * 0.68)}<span>Simpatico</span></div>`;
export const LOCKUP_CSS = `.lockup{display:inline-flex;align-items:center;gap:.3em;background:${C.dark};color:${C.ink};font-weight:800;letter-spacing:-.02em;box-shadow:0 0 0 2px rgba(255,255,255,.12)}`;

export const charOf = (pose) => (POSES[pose] && !["two-people-one-phone", "family-group-call", "friends-cheers"].includes(pose) ? Object.keys(CAST).find((c) => pose.startsWith(c + "-")) : null);
export const isPair = (pose) => !charOf(pose);
/** Head and shoulders of a cast member, for video tiles. */
export function bust(who, pose = {}, attrs = "") {
  const s = CAST[who].scale;
  return `<svg ${attrs} viewBox="${-190 * s} ${-650 * s} ${380 * s} ${350 * s}" preserveAspectRatio="xMidYMax slice">${figure(who, { expr: "grin", ...pose })}</svg>`;
}
/** A pose placed with its feet at (x, y) and about h pixels tall (pairs are fitted to maxW). */
export function placed(pose, { x, y, h, maxW = 900, flip = false }) {
  let scale = h / 610;
  if (isPair(pose)) scale = Math.min(scale, maxW / (pose === "family-group-call" ? 720 : 700));
  return POSES[pose]({ x, y, scale, flip });
}
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
