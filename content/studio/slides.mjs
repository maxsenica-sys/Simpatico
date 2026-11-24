// Slide and scene templates. One function draws every beat at either size:
//   ig = 1080 x 1350 (Instagram feed),  tt = 1080 x 1920 (TikTok photo mode, Reels, Stories),
// keeping text out of the areas the TikTok and Reels buttons cover.
import { C, HEAD, LOCKUP_CSS, lockup, mark, placed, isPair, esc, BUBBLE_L, BUBBLE_R } from "./kit.mjs";
import { SCREEN_CSS, phone, spoken } from "./screens.mjs";

export const SIZE = { ig: { W: 1080, H: 1350 }, tt: { W: 1080, H: 1920 } };
const TONES = {
  blue: { bg: C.blue, fg: C.dark, em: "#ffffff", disc: "rgba(255,255,255,.2)", ground: "#4878ec", pill: C.dark, pillFg: C.ink, motif: "rgba(255,255,255,.1)" },
  ink: { bg: C.ink, fg: C.dark, em: "#3f6fe8", disc: C.mint, ground: "#dfe3ea", pill: C.dark, pillFg: C.ink, motif: "rgba(91,140,255,.1)" },
  inkblue: { bg: C.ink, fg: C.dark, em: "#3f6fe8", disc: C.blue, ground: "#dfe3ea", pill: C.dark, pillFg: C.ink, motif: "rgba(95,224,189,.22)" },
  dark: { bg: C.dark, fg: C.ink, em: C.mint, disc: C.ink, ground: "#cfd4dc", pill: C.ink, pillFg: C.dark, motif: "rgba(255,255,255,.045)" },
  mint: { bg: C.mint, fg: C.dark, em: C.dark, disc: "rgba(255,255,255,.34)", ground: "#47cfa9", pill: C.dark, pillFg: C.ink, motif: "rgba(255,255,255,.2)" },
};
export const CSS = `${LOCKUP_CSS}${SCREEN_CSS}
.slide{position:relative;overflow:hidden;font-family:Nunito,sans-serif}
.slide>*{position:absolute}
.slide .art{left:0;top:0}
.pill{display:inline-flex;align-items:center;height:54px;padding:0 24px;border-radius:27px;font-size:25px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
.head{font-weight:800;letter-spacing:-.028em;line-height:1.05;text-wrap:balance;display:flex;flex-direction:column;justify-content:flex-start}
.head .t{display:block}
.head .w{display:inline-block;white-space:pre}
.dots{display:flex;gap:11px;align-items:center}
.dots i{width:13px;height:13px;border-radius:50%;background:currentColor;opacity:.28}
.dots i.on{opacity:1;width:34px;border-radius:7px}
.swipe{display:inline-flex;align-items:center;gap:12px;height:64px;padding:0 26px;border-radius:32px;font-size:28px;font-weight:800}
.swipe svg{width:30px;height:30px}
.say{padding:20px 28px 22px;border-radius:34px 34px 34px 8px;background:${C.dark};color:${C.ink};font-size:40px;font-weight:700;line-height:1.2;max-width:470px;box-shadow:10px 12px 0 rgba(11,13,16,.18)}
.say small{display:block;font-family:Nunito,sans-serif;font-size:20px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${C.mint};margin-bottom:4px}
.band{border-radius:36px;background:${C.dark};color:${C.ink};padding:26px 34px 30px;display:flex;gap:22px;align-items:center}
.band .tx{font-size:37px;font-weight:800;line-height:1.16;letter-spacing:-.015em;text-wrap:balance}
.band small{display:block;font-size:20px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:${C.mint};margin-bottom:5px}
.askcard{display:flex;flex-direction:column;align-items:center;gap:6px;padding:44px 60px 38px;border-radius:64px;background:rgba(255,255,255,.06);box-shadow:0 0 0 2px rgba(255,255,255,.12) inset}
.askcard span{font-size:84px;font-weight:800;letter-spacing:-.03em;color:${C.ink}}
.askcard.small{flex-direction:row;gap:22px;padding:26px 48px 26px 36px;border-radius:48px}.askcard.small span{font-size:72px}
.steps{display:flex;flex-direction:column;gap:22px}
.step{display:flex;align-items:center;gap:26px;font-size:42px;font-weight:700;color:${C.ink};line-height:1.15;letter-spacing:-.01em}
.step b{flex:none;width:76px;height:76px;border-radius:50%;background:${C.mint};color:${C.dark};display:grid;place-items:center;font-size:40px;font-weight:800}
.slogan{font-size:32px;font-weight:700;color:rgba(244,245,247,.6);text-align:center;line-height:1.25}
`;
const FIT = `<script>for(const el of document.querySelectorAll('[data-fit]')){let[max,min]=el.dataset.fit.split(',').map(Number),s=max;el.style.fontSize=s+'px';while(s>min&&(el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1)){s-=2;el.style.fontSize=s+'px'}}</script>`;

const words = (s) => esc(s).split(" ").map((w, i, a) => `<span class="w">${w}${i < a.length - 1 ? " " : ""}</span>`).join("");
/** Headline: the last sentence takes the accent colour when there are two or more. */
function head(text, t, box, fit, accent = true) {
  const parts = text.match(/[^.?!]+[.?!]+["']?\s*|[^.?!]+$/g)?.map((s) => s.trim()).filter(Boolean) || [text];
  let inner;
  if (accent && parts.length > 1) { const last = parts.pop(); inner = `<span class="t">${words(parts.join(" ") + " ")}<span style="color:${t.em}">${words(last)}</span></span>`; }
  else inner = `<span class="t">${words(text)}</span>`;
  return `<div class="head" data-fit="${fit}" style="left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px;color:${t.fg}">${inner}</div>`;
}
const art = (W, H, inner) => `<svg class="art" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${inner}</svg>`;
const motif = (t, x, y, k, right = false) => `<path d="${right ? BUBBLE_R : BUBBLE_L}" fill="${t.motif}" transform="translate(${x} ${y}) scale(${k})"/>`;
function stage(t, pose, { x, feet, h, maxW, flip }) {
  const pair = isPair(pose);
  const r = pair ? Math.min(h * 0.5, 330) : h * 0.5;
  const hh = pair ? Math.min(h, (maxW / 700) * 610) : h;
  return `<g class="stage"><circle class="disc" cx="${x}" cy="${feet - hh * 0.5}" r="${r}" fill="${t.disc}"/><ellipse cx="${x}" cy="${feet + 8}" rx="${pair ? maxW * 0.5 : h * 0.4}" ry="${h * 0.05}" fill="${t.ground}"/><g class="chr" style="transform-origin:${x}px ${feet}px">${placed(pose, { x, y: feet, h, maxW, flip })}</g></g>`;
}
const dots = (i, t) => `<div class="dots" style="color:${t.fg}">${[0, 1, 2, 3, 4, 5].map((n) => `<i class="${n === i ? "on" : ""}"></i>`).join("")}</div>`;
const LABELS = ["", "Right now", "What it costs", "With Simpatico", "What changes", ""];

/**
 * One frame. beat: 0 hook, 1 old way, 2 cost, 3 mechanic, 4 change, 5 ask, "still".
 * opts: { fmt: "ig" | "tt", hook: text override, chrome: show page dots and swipe hint }
 */
export function frame(post, beat, opts = {}) {
  const fmt = opts.fmt || "ig", { W, H } = SIZE[fmt], tt = fmt === "tt";
  const n = parseInt(post.post_id.slice(1), 10);
  const chrome = opts.chrome !== false;
  const hookText = opts.hook || post.hook;
  const text = [hookText, post.old_way, post.cost, post.mechanic, post.change, post.ask][beat];
  const pad = 76;
  // Text column: TikTok keeps clear of the buttons down the right side and the caption at the bottom.
  const tw = tt ? 850 : 928;
  const top = tt ? 196 : 76;          // lockup (tt) or label (ig) row
  const headY = tt ? 300 : 158;
  const feet = tt ? 1500 : 1182;
  const footY = tt ? 0 : H - 60 - 64;
  let tone, inner = "";
  const lock = (t) => `<div style="left:${pad}px;top:${tt ? top : footY}px">${lockup(64)}</div>`;
  const label = (t, s) => (s ? `<div class="pill" data-a="label" style="left:${tt ? pad + 262 : pad}px;top:${tt ? top + 5 : top}px;background:${t.pill};color:${t.pillFg}">${s}</div>` : "");
  const foot = (t, i) => (chrome && !tt ? `<div style="right:${pad}px;top:${footY + 26}px">${dots(i, t)}</div>` : "");

  if (beat === "still") {
    tone = TONES[["blue", "mint", "ink"][n % 3]];
    const pw = tt ? 400 : 372;
    const pTop = tt ? 830 : 424, pLeft = tt ? 470 : 610;
    const fy = tt ? 1500 : 1086, ch = tt ? 560 : 500;
    inner += art(W, H, motif(tone, -160, tt ? 900 : 560, 22) + stage(tone, post.pose_1, { x: tt ? 250 : 320, feet: fy, h: ch, maxW: tt ? 400 : 480 }));
    inner += head(hookText, tone, { x: pad, y: tt ? 290 : 84, w: tw, h: tt ? 330 : 320 }, tt ? "104,54" : "92,50");
    inner += `<div data-a="phone" style="left:${pLeft}px;top:${pTop}px">${phone(post, pw)}</div>`;
    inner += `<div class="band" data-a="band" style="left:${pad}px;${tt ? `top:644px;width:${tw}px` : `right:${pad}px;bottom:56px`}">${mark(86)}<div class="tx"><small>Simpatico</small>${esc(post.mechanic)}</div></div>`;
    if (tt) inner += lock(tone);
  } else if (beat === 5) {
    // The ask, then how simple it is, the same three steps on every post.
    tone = TONES.dark;
    const steps = post.ui_card === "ui-inperson-split" ? ["Open In person.", "Put the phone between you.", "Each of you reads your own half."]
      : post.ui_card === "ui-group-captions" ? ["Send one link.", "Everyone taps it. No app needed.", "Each person reads in their own language."]
      : ["Send a link.", "They tap it. No app, no account.", "Talk in your language. Read theirs."];
    const cy = tt ? 250 : 96;
    inner += art(W, H, motif(tone, -260, H - 760, 30) + motif(tone, W - 700, -420, 26, true));
    inner += `<div data-a="card" style="left:0;right:0;top:${cy}px;display:flex;justify-content:center"><div class="askcard small">${mark(150, "big")}<span>Simpatico</span></div></div>`;
    inner += `<div class="head" data-fit="80,48" style="left:${pad + 40}px;top:${cy + 330}px;width:${W - 2 * pad - 80}px;height:190px;color:${C.ink};text-align:center;align-items:center;justify-content:center"><span class="t">${words(text)}</span></div>`;
    inner += `<div class="steps" style="left:${tt ? 110 : 150}px;top:${cy + 560}px;width:${tt ? 760 : 780}px">${steps.map((t, i) => `<div class="step" data-a="step"><b>${i + 1}</b><span>${esc(t)}</span></div>`).join("")}</div>`;
    inner += `<div class="slogan" data-a="slogan" style="left:0;right:0;top:${cy + (tt ? 1010 : 985)}px">Different languages. Same conversation.</div>`;
    if (chrome && !tt) inner += `<div style="left:0;right:0;top:${footY + 26}px;display:flex;justify-content:center">${dots(5, tone)}</div>`;
  } else if (beat === 3) {
    tone = TONES.mint;
    const pw = tt ? 470 : 424, pTop = tt ? 650 : 446, pLeft = tt ? 430 : 580;
    const say = spoken(post);
    const pair = isPair(post.pose_4);
    const fy = tt ? 1490 : 1186, ch = tt ? 560 : 520;
    inner += art(W, H, motif(tone, tt ? 300 : 420, tt ? 700 : 420, 24, true) + stage(tone, post.pose_4, { x: tt ? 215 : 296, feet: fy, h: pair ? 420 : ch, maxW: tt ? 380 : 470 }));
    inner += head(text, tone, { x: pad, y: headY, w: tw, h: tt ? 320 : 270 }, tt ? "78,46" : "70,44", false);
    if (say) inner += `<div class="say ${say.cls}" data-a="say" ${say.rtl ? 'dir="rtl"' : ""} style="left:${pad}px;top:${tt ? 660 : 462}px"><small dir="ltr">${say.lang}</small>${esc(say.text)}</div>`;
    inner += `<div data-a="phone" style="left:${pLeft}px;top:${pTop}px">${phone(post, pw)}</div>`;
    inner += label(tone, LABELS[3]) + lock(tone);
  } else {
    tone = TONES[[n % 2 ? "dark" : "blue", "ink", "dark", "mint", "inkblue"][beat]];
    const pose = [post.pose_1, post.pose_2, post.pose_3, post.pose_4, post.pose_5][beat];
    const x = [W * 0.6, W * 0.42, W * 0.5, 0, W * 0.56][beat];
    const ch = tt ? 670 : beat === 0 ? 560 : 606;
    const m = beat === 0 ? motif(tone, -200, feet - 700, 24) : beat === 4 ? motif(tone, W - 820, feet - 820, 24, true) : "";
    inner += art(W, H, m + stage(tone, pose, { x: isPair(pose) ? W / 2 : x, feet, h: ch, maxW: tt ? 900 : 860 }));
    inner += head(text, tone, { x: pad, y: beat === 0 && !tt ? 96 : headY, w: tw, h: tt ? 420 : beat === 0 ? 470 : 400 }, beat === 0 ? (tt ? "128,56" : "118,56") : tt ? "100,48" : "96,46");
    inner += label(tone, LABELS[beat]) + lock(tone);
    if (beat === 0 && chrome) inner += `<div class="swipe" style="${tt ? `left:${pad + 262}px;top:${top}px` : `right:${pad}px;top:${footY}px`};background:${tone.pill};color:${tone.pillFg}">Swipe<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>`;
    else inner += foot(tone, beat);
  }
  return `<div class="slide" style="width:${W}px;height:${H}px;background:${tone.bg}">${inner}</div>`;
}
export const page = (body, extra = "") => `<!doctype html><html><head>${HEAD}<style>${CSS}body{margin:0}${extra}</style></head><body>${body}${FIT}</body></html>`;
