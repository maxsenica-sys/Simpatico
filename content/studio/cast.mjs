// The cast, drawn by code: one skeleton, eight people. A pose is a set of joint angles, so faces,
// proportions and clothes cannot drift between posts. figure(who, pose) returns an SVG <g> whose
// origin is the ground under the figure's feet; a standing adult is about 560 units tall.
export const C = { dark: "#0b0d10", ink: "#f4f5f7", blue: "#5b8cff", mint: "#5fe0bd", line: "#0b0d10" };
const CLOTH = "#272d3a"; // dark clothes: a shade off the outline so folds and arms still read
const OUT = 5.5; // outline weight
const rad = (d) => (d * Math.PI) / 180;
// Angles: 0 = straight down, 90 = towards screen right, -90 = screen left, 180 = straight up.
const step = ([x, y], angle, len) => [x + Math.sin(rad(angle)) * len, y + Math.cos(rad(angle)) * len];
const n1 = (n) => Number(n.toFixed(1));
const P = (p) => `${n1(p[0])} ${n1(p[1])}`;
const mix = (a, b, t) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("");
const shade = (c, t = 0.16) => mix(c, "#6b2f1a", t);

/** A limb segment: a capsule that tapers from radius r0 at p0 to r1 at p1; either end can be cut flat (a hem). */
function capsule(p0, r0, p1, r1, flat0 = false, flat1 = false) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d, ny = dx / d;
  const a = [p0[0] + nx * r0, p0[1] + ny * r0], b = [p1[0] + nx * r1, p1[1] + ny * r1], c = [p1[0] - nx * r1, p1[1] - ny * r1], e = [p0[0] - nx * r0, p0[1] - ny * r0];
  return `M${P(a)}L${P(b)}${flat1 ? `L${P(c)}` : `A${n1(r1)} ${n1(r1)} 0 0 0 ${P(c)}`}L${P(e)}${flat0 ? "" : `A${n1(r0)} ${n1(r0)} 0 0 0 ${P(a)}`}Z`;
}
/** Several shapes sharing one outline: all the dark edges first, then the fills, so no seams show where they join. */
const blob = (parts) =>
  parts.map((p) => `<path d="${p.d}" ${p.t ? `transform="${p.t}"` : ""} fill="${C.line}" stroke="${C.line}" stroke-width="${OUT * 2}" stroke-linejoin="round"/>`).join("") +
  parts.map((p) => `<path d="${p.d}" ${p.t ? `transform="${p.t}"` : ""} fill="${p.fill}"/>`).join("");
const shape = (d, fill, t) => blob([{ d, fill, t }]);
const line = (d, w = 4, color = C.line, extra = "") => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;

// ------------------------------------------------------------------ the people
const BODY = { leg: 236, torso: 160, sw: 66, cw: 60, ww: 54, hw: 58, up: 86, low: 80, head: 1, arm: 1 };
export const CAST = {
  traveller: { skin: "#f3c5a0", hair: "short", hairColor: "#c47f3a", top: C.mint, sleeves: "short", bottom: "shorts", bottomColor: CLOTH, shoes: C.ink, extras: ["backpack", "sunnies"], scale: 1, body: {} },
  grandma: { skin: "#ecb690", hair: "bun", hairColor: "#e6e3de", top: C.blue, sleeves: "long", bottom: "skirt", skirt: 150, bottomColor: CLOTH, shoes: CLOTH, extras: ["glasses", "cardigan"], scale: 0.92, body: { leg: 214, torso: 156, sw: 64, cw: 64, ww: 64, hw: 66, head: 1.04 }, brow: "#8d9098" },
  grandkid: { skin: "#eeb68d", hair: "kid", hairColor: "#3a2a22", top: C.ink, sleeves: "short", bottom: "shorts", bottomColor: C.blue, shoes: CLOTH, extras: ["stripes"], scale: 0.7, body: { leg: 200, torso: 142, sw: 58, cw: 54, ww: 52, hw: 54, head: 1.3, up: 78, low: 72 } },
  "partner-a": { skin: "#f4cdb0", hair: "quiff", hairColor: "#7a5233", top: C.blue, sleeves: "long", bottom: "pants", bottomColor: CLOTH, shoes: C.ink, extras: ["crew", "stubble"], scale: 1.03, body: { sw: 70, cw: 64, ww: 58 } },
  "partner-b": { skin: "#e6ae86", hair: "long", hairColor: "#1f1a1d", top: C.mint, sleeves: "long", bottom: "pants", bottomColor: CLOTH, shoes: C.ink, extras: ["hoops", "vneck"], scale: 0.97, body: { sw: 60, cw: 56, ww: 48, hw: 58 } },
  student: { skin: "#dea677", hair: "fringe", hairColor: "#14161b", top: CLOTH, sleeves: "long", bottom: "pants", bottomColor: C.blue, shoes: C.ink, extras: ["hood"], scale: 0.98, body: { sw: 66, cw: 62, ww: 60, hw: 60 } },
  shopkeeper: { skin: "#c98d5c", hair: "bald", hairColor: "#3c3f47", top: C.ink, sleeves: "short", bottom: "pants", bottomColor: CLOTH, shoes: CLOTH, extras: ["apron", "moustache", "collar"], scale: 1.01, body: { sw: 72, cw: 70, ww: 72, hw: 68 } },
  newcomer: { skin: "#9a6240", hair: "afro", hairColor: "#1c1615", top: C.ink, sleeves: "long", bottom: "skirt", skirt: 112, bottomColor: C.mint, shoes: CLOTH, extras: ["tote", "studs"], scale: 0.96, body: { sw: 60, cw: 56, ww: 48, hw: 60 } },
};
const anatomy = (who) => ({ ...BODY, ...CAST[who].body });
/** Where the head sits on a standing figure (before the figure's own scale): for cropping video tiles. */
export function headBox(who) {
  const b = anatomy(who);
  return { cy: -(b.leg + b.torso + 60 * b.head), r: 64 * b.head };
}

// ------------------------------------------------------------------ faces
function face(c, expr, look = [0, 0]) {
  const [lx, ly] = look;
  const ox = lx * 7, oy = ly * 4, ex = 22, ey = 4 + oy;
  const bc = c.brow || (c.hairColor === "#c47f3a" ? "#8a5626" : mix(c.hairColor, "#000000", 0.2));
  const dot = (x) => `<ellipse cx="${n1(x + ox)}" cy="${n1(ey)}" rx="5.6" ry="7.6" fill="${C.line}"/><circle cx="${n1(x + ox + 1.9)}" cy="${n1(ey - 2.9)}" r="1.9" fill="#fff"/>`;
  const arcUp = (x) => line(`M${n1(x + ox - 8.5)} ${n1(ey + 3)}Q${n1(x + ox)} ${n1(ey - 9)} ${n1(x + ox + 8.5)} ${n1(ey + 3)}`, 4.6);
  const arcDown = (x) => line(`M${n1(x + ox - 8.5)} ${n1(ey - 2)}Q${n1(x + ox)} ${n1(ey + 8)} ${n1(x + ox + 8.5)} ${n1(ey - 2)}`, 4.6);
  // brow(side, inner lift, outer lift): positive lifts raise that end
  const brow = (s, inner = 0, outer = 0, y = -15) => line(`M${n1(s * (ex - 11) + ox)} ${n1(y + oy - inner)}Q${n1(s * ex + ox)} ${n1(y + oy - 5 - (inner + outer) / 2)} ${n1(s * (ex + 11) + ox)} ${n1(y + oy - outer)}`, 4.4, bc);
  let eyes = dot(-ex) + dot(ex), brows = brow(-1) + brow(1), mouth = "", extra = "";
  const mx = ox * 0.5, my = 36 + oy * 0.5;
  const open = (w, h) => `<path d="M${n1(mx - w)} ${n1(my - 4)}Q${n1(mx)} ${n1(my - 4 + h)} ${n1(mx + w)} ${n1(my - 4)}Z" fill="#3a1418" stroke="${C.line}" stroke-width="3.6" stroke-linejoin="round"/>` +
    `<path d="M${n1(mx - w + 3.5)} ${n1(my - 3)}Q${n1(mx)} ${n1(my - 3 + h * 0.34)} ${n1(mx + w - 3.5)} ${n1(my - 3)}Z" fill="#fff"/>`;
  switch (expr) {
    case "grin": mouth = open(16, 26); break;
    case "laugh": eyes = arcUp(-ex) + arcUp(ex); brows = brow(-1, 0, 2, -18) + brow(1, 0, 2, -18); mouth = open(19, 36) + `<path d="M${n1(mx - 8)} ${n1(my + 10)}Q${n1(mx)} ${n1(my + 4)} ${n1(mx + 8)} ${n1(my + 10)}Q${n1(mx)} ${n1(my + 15)} ${n1(mx - 8)} ${n1(my + 10)}Z" fill="#f2828c"/>`; break;
    case "flat": mouth = line(`M${n1(mx - 10)} ${n1(my + 2)}H${n1(mx + 10)}`, 4.6); break;
    case "sad": brows = brow(-1, 7, -2) + brow(1, 7, -2); mouth = line(`M${n1(mx - 11)} ${n1(my + 6)}Q${n1(mx)} ${n1(my - 4)} ${n1(mx + 11)} ${n1(my + 6)}`, 4.6); break;
    case "worried": brows = brow(-1, 8, -2) + brow(1, 8, -2); mouth = line(`M${n1(mx - 9)} ${n1(my + 5)}Q${n1(mx)} ${n1(my - 2)} ${n1(mx + 9)} ${n1(my + 5)}`, 4.6);
      extra = `<path d="M47 -34q7 10 0 15q-7 -5 0 -15Z" fill="${C.blue}" stroke="${C.line}" stroke-width="3" stroke-linejoin="round"/>`; break;
    case "o": brows = brow(-1, 4, 4, -19) + brow(1, 4, 4, -19); mouth = `<ellipse cx="${n1(mx)}" cy="${n1(my + 3)}" rx="7" ry="9" fill="#3a1418" stroke="${C.line}" stroke-width="3.6"/>`; break;
    case "confused": brows = brow(-1, -4, 2) + brow(1, 6, 6, -19); mouth = line(`M${n1(mx - 11)} ${n1(my + 3)}Q${n1(mx - 4)} ${n1(my - 4)} ${n1(mx + 2)} ${n1(my + 2)}T${n1(mx + 12)} ${n1(my)}`, 4.6); break;
    case "eyeroll": {
      const roll = (x) => `<ellipse cx="${x}" cy="${ey}" rx="9.5" ry="10.5" fill="#fff" stroke="${C.line}" stroke-width="3.6"/><circle cx="${x + 2.5}" cy="${ey - 5}" r="4.6" fill="${C.line}"/>`;
      eyes = roll(-ex) + roll(ex); brows = brow(-1, -3, 1, -19) + brow(1, -3, 1, -19); mouth = line(`M${n1(mx - 10)} ${n1(my + 3)}Q${n1(mx + 2)} ${n1(my + 2)} ${n1(mx + 10)} ${n1(my - 2)}`, 4.6); break;
    }
    case "relief": eyes = arcDown(-ex) + arcDown(ex); brows = brow(-1, 3, 0, -17) + brow(1, 3, 0, -17); mouth = line(`M${n1(mx - 13)} ${n1(my - 2)}Q${n1(mx)} ${n1(my + 12)} ${n1(mx + 13)} ${n1(my - 2)}`, 4.6); break;
    default: mouth = line(`M${n1(mx - 13)} ${n1(my - 2)}Q${n1(mx)} ${n1(my + 12)} ${n1(mx + 13)} ${n1(my - 2)}`, 4.6); // smile
  }
  const nose = line(`M${n1(ox * 0.7 + 1)} ${n1(13 + oy * 0.6)}q-6 9 3 10`, 3.8, shade(c.skin, 0.34));
  const blush = `<circle cx="${n1(-39 + ox * 0.4)}" cy="${n1(27 + oy * 0.4)}" r="10.5" fill="#ff5c6c" opacity=".2"/><circle cx="${n1(39 + ox * 0.4)}" cy="${n1(27 + oy * 0.4)}" r="10.5" fill="#ff5c6c" opacity=".2"/>`;
  return blush + eyes + brows + nose + mouth + extra;
}

// ------------------------------------------------------------------ heads and hair
function head(c, expr, look, tilt, k) {
  const hc = c.hairColor, ex = c.extras || [];
  const skull = "M-60 -6C-60 -46 -36 -66 0 -66C36 -66 60 -46 60 -6C60 30 38 64 0 64C-38 64 -60 30 -60 -6Z";
  let back = "", front = "", acc = "";
  switch (c.hair) {
    case "short":
      front = shape("M-63 4C-71 -44 -44 -84 2 -84C46 -84 71 -46 63 4C60 -14 54 -27 44 -35C30 -45 8 -47 -8 -41C-26 -35 -44 -35 -52 -43C-58 -30 -62 -14 -63 4Z", hc); break;
    case "quiff":
      front = shape("M-63 2C-71 -40 -50 -86 0 -88C42 -90 73 -52 63 2C60 -18 54 -30 46 -37C24 -35 -6 -41 -22 -57C-30 -45 -48 -35 -56 -31C-60 -20 -62 -9 -63 2Z", hc); break;
    case "long":
      back = shape("M-66 -6C-75 -72 -40 -92 0 -92C40 -92 75 -72 66 -6C68 40 80 86 64 114C44 124 24 120 16 108L-16 108C-24 120 -44 124 -64 114C-80 86 -68 40 -66 -6Z", hc);
      front = shape("M0 -70C-36 -72 -67 -44 -62 8C-52 -18 -30 -40 0 -51C30 -40 52 -18 62 8C67 -44 36 -72 0 -70Z", hc) +
        shape("M-63 2C-70 34 -72 70 -62 104C-52 112 -42 108 -38 98C-46 70 -50 44 -52 22Z", hc) + shape("M63 2C70 34 72 70 62 104C52 112 42 108 38 98C46 70 50 44 52 22Z", hc); break;
    case "bun":
      back = shape("M-26 -84a26 23 0 1 1 52 0a26 23 0 1 1 -52 0Z", hc);
      front = shape("M-62 4C-69 -42 -44 -78 0 -78C44 -78 69 -42 62 4C54 -22 36 -45 0 -47C-36 -45 -54 -22 -62 4Z", hc) + line("M-22 -64Q0 -72 22 -64", 3.4, mix(hc, "#000000", 0.25)); break;
    case "kid":
      front = shape("M-63 6C-72 -40 -46 -86 -4 -86C10 -94 24 -86 30 -82C56 -76 71 -40 63 6C58 -12 52 -23 46 -31L34 -20L26 -37L10 -22L-2 -39L-18 -24L-30 -39L-44 -26C-54 -20 -60 -8 -63 6Z", hc); break;
    case "fringe":
      front = shape("M-64 12C-75 -44 -44 -88 0 -88C44 -88 75 -44 64 12C62 -4 58 -14 54 -20C36 -12 -36 -12 -54 -20C-58 -14 -62 -4 -64 12Z", hc) + line("M-18 -84Q-8 -50 -20 -18", 3.2, mix(hc, "#ffffff", 0.22)); break;
    case "bald":
      front = line("M-24 -51Q-6 -60 12 -55", 3.6, "#ffffff", 'opacity=".55"'); break;
    case "afro":
      back = shape("M-86 -22C-88 -70 -50 -104 0 -104C50 -104 88 -70 86 -22C86 14 70 40 52 46L-52 46C-70 40 -86 14 -86 -22Z", hc);
      front = shape("M-59 -6C-60 -44 -32 -63 0 -63C32 -63 60 -44 59 -6C50 -30 30 -44 0 -44C-30 -44 -50 -30 -59 -6Z", hc); break;
  }
  if (ex.includes("stubble")) acc += `<path d="M-58 12C-56 44 -34 63 0 63C34 63 56 44 58 12C50 28 40 32 28 30C12 23 -12 23 -28 30C-40 32 -50 28 -58 12Z" fill="${hc}" opacity=".3"/>`;
  const f = face(c, expr, look);
  if (ex.includes("moustache")) acc += `<path d="M-24 31C-13 19 -4 22 0 28C4 22 13 19 24 31C13 40 4 35 0 33C-4 35 -13 40 -24 31Z" fill="${hc}" stroke="${C.line}" stroke-width="3.4" stroke-linejoin="round"/>`;
  if (ex.includes("glasses")) acc += `<circle cx="-22" cy="4" r="15.5" fill="rgba(255,255,255,.28)" stroke="${C.line}" stroke-width="4.2"/><circle cx="22" cy="4" r="15.5" fill="rgba(255,255,255,.28)" stroke="${C.line}" stroke-width="4.2"/>` + line("M-6.5 3Q0 -1 6.5 3", 4.2) + line("M-37.5 2L-58 -2M37.5 2L58 -2", 3.6);
  if (ex.includes("sunnies")) acc += `<g transform="translate(0 -58)">` + shape("M-34 -10h28v9a14 12 0 0 1 -28 0Z", C.blue) + shape("M6 -10h28v9a14 12 0 0 1 -28 0Z", C.blue) + line("M-6 -6h12", 4.4) + `</g>`;
  if (ex.includes("hoops")) acc += `<circle cx="-60" cy="30" r="9" fill="none" stroke="${C.line}" stroke-width="6.5"/><circle cx="-60" cy="30" r="9" fill="none" stroke="#f3bd4e" stroke-width="3.2"/><circle cx="60" cy="30" r="9" fill="none" stroke="${C.line}" stroke-width="6.5"/><circle cx="60" cy="30" r="9" fill="none" stroke="#f3bd4e" stroke-width="3.2"/>`;
  if (ex.includes("studs")) acc += `<circle cx="-60" cy="22" r="4.6" fill="#f3bd4e" stroke="${C.line}" stroke-width="2.6"/><circle cx="60" cy="22" r="4.6" fill="#f3bd4e" stroke="${C.line}" stroke-width="2.6"/>`;
  const ear = (s) => shape(`M${s * 56} -8C${s * 70} -14 ${s * 74} 14 ${s * 58} 20Z`, c.skin) + line(`M${s * 62} -1Q${s * 66} 5 ${s * 61} 11`, 2.8, shade(c.skin, 0.34));
  const mouthOnTop = ex.includes("moustache");
  const wrap = (inner) => `<g transform="rotate(${tilt}) scale(${k})">${inner}</g>`;
  return { back: wrap(back), front: wrap(`${ear(-1)}${ear(1)}${shape(skull, c.skin)}${mouthOnTop ? acc.replace(/<path d="M-24 31[^>]*>/, "") : ""}${f}${front}${mouthOnTop ? acc.match(/<path d="M-24 31[^>]*>/)[0] : acc}`) };
}

// ------------------------------------------------------------------ hands
// Drawn pointing along +y from the wrist, then turned to follow the forearm. side: which way the thumb sits.
function hand(kind, skin, side) {
  const s = side;
  const palm = "M-14 -6C-18 6 -18 24 -11 32C-5 39 8 39 13 32C19 24 18 6 14 -6Z";
  const thumb = capsule([s * 12, 6], 6.5, [s * 21, 20], 5.6);
  if (kind === "wave") {
    const fingers = [[-11, 17], [-3.8, 22], [3.8, 21], [11, 16]].map(([x, l]) => ({ d: capsule([x, 16], 5.4, [x * 1.5, 22 + l], 4.8), fill: skin }));
    return blob([{ d: capsule([s * 13, 4], 6.6, [s * 27, 14], 5.6), fill: skin }, ...fingers, { d: "M-15 -6C-18 4 -18 16 -14 24L14 24C18 16 18 4 15 -6Z", fill: skin }]);
  }
  if (kind === "point") return blob([{ d: capsule([s * -4, 18], 6, [s * -3, 50], 5.2), fill: skin }, { d: "M-14 -6C-18 4 -18 18 -12 25C-6 30 8 30 13 25C18 18 18 4 14 -6Z", fill: skin }, { d: capsule([s * 10, 8], 6.2, [s * 2, 22], 5.6), fill: skin }]) + line(`M${s * 4} 20v8`, 2.6, shade(skin, 0.4));
  if (kind === "hold") return blob([{ d: "M-15 -6C-19 4 -19 20 -13 27C-6 32 8 32 14 27C19 20 19 4 15 -6Z", fill: skin }, { d: capsule([s * 13, 2], 6.4, [s * 15, 18], 5.8), fill: skin }]) + line(`M${s * -9} 12h${s * 12}M${s * -9} 20h${s * 11}`, 2.6, shade(skin, 0.4));
  return blob([{ d: thumb, fill: skin }, { d: palm, fill: skin }]);
}

// ------------------------------------------------------------------ props (held upright unless turned)
function prop(kind, at, angle, skin) {
  const g = (inner) => `<g transform="translate(${P(at)}) rotate(${angle || 0})">${inner}</g>`;
  if (kind === "phone") return g(shape("M-21 -58h42a7 7 0 0 1 7 7v62a7 7 0 0 1 -7 7h-42a7 7 0 0 1 -7 -7v-62a7 7 0 0 1 7 -7Z", CLOTH) + `<rect x="-22" y="-51" width="44" height="62" rx="4" fill="${C.mint}"/><rect x="-14" y="-41" width="28" height="6" rx="3" fill="#fff" opacity=".85"/><rect x="-14" y="-29" width="20" height="6" rx="3" fill="#fff" opacity=".85"/>`);
  if (kind === "phone-back") return g(shape("M-21 -58h42a7 7 0 0 1 7 7v62a7 7 0 0 1 -7 7h-42a7 7 0 0 1 -7 -7v-62a7 7 0 0 1 7 -7Z", "#dfe4ec") + `<rect x="-21" y="-51" width="21" height="21" rx="6.5" fill="#aab3c2"/><circle cx="-10.5" cy="-40.5" r="5" fill="${CLOTH}"/>`);
  if (kind === "letter") return g(shape("M-34 -78h56l12 12v70h-68Z", C.ink) + line("M22 -78v12h12", 3.2) + line("M-20 -52h38M-20 -38h38M-20 -24h24", 4, "#9aa3b2"));
  if (kind === "cup") return g(shape("M-18 -48h36l-5 46a5 5 0 0 1 -5 4h-16a5 5 0 0 1 -5 -4Z", C.ink) + `<path d="M-16.5 -34h33l-1.6 15h-29.8Z" fill="${C.blue}"/>`);
  if (kind === "laptop") return g(shape("M-74 -92h148a6 6 0 0 1 6 6v82h-160v-82a6 6 0 0 1 6 -6Z", CLOTH) + `<rect x="-68" y="-84" width="136" height="72" rx="3" fill="${C.blue}"/><circle cy="-48" r="9" fill="#fff" opacity=".85"/>` + shape("M-92 -4h184v10a8 8 0 0 1 -8 8h-168a8 8 0 0 1 -8 -8Z", C.ink));
  if (kind === "tote") return g(line("M-17 4C-17 -30 17 -30 17 4", 9.5) + line("M-17 4C-17 -30 17 -30 17 4", 4, C.blue) + shape("M-36 2h72l-6 80a6 6 0 0 1 -6 5h-48a6 6 0 0 1 -6 -5Z", C.blue) + `<circle cy="42" r="12" fill="#fff" opacity=".9"/>`);
  return "";
}

let uid = 0;
// ------------------------------------------------------------------ the figure
/**
 * pose: { armL:[upper,lower], armR:[upper,lower], handL, handR ("wave" | "point" | "hold"), lean, shift (hips sideways),
 *         headTilt, look:[x,y], expr, sit, propL, propR, propAngleL, propAngleR, noTote }
 * "L" is the arm on the left of the picture.
 */
export function figure(who, pose = {}, opts = {}) {
  const c = CAST[who], b = anatomy(who), id = `f${uid++}`;
  const p = { armL: [-9, -3], armR: [9, 3], lean: 0, shift: 0, headTilt: 0, look: [0, 0], expr: "smile", ...pose };
  const ex = c.extras || [], sit = !!p.sit;
  const skin = c.skin;
  // ---- legs: feet stay planted, hips move
  const ankleL = [-(sit ? 60 : 33), -24], ankleR = [sit ? 60 : 33, -24];
  const hipC = sit ? [0, -(b.leg * 0.5 + 14)] : [p.shift, -b.leg + Math.abs(p.shift) * 0.1];
  const hL = [hipC[0] - 29, hipC[1]], hR = [hipC[0] + 29, hipC[1]];
  const knee = (h, a, s) => (sit ? [a[0] - s * 2, h[1] + 12] : [(h[0] + a[0]) / 2 + s * 3, (h[1] + a[1]) / 2 - 6]);
  const kL = knee(hL, ankleL, -1), kR = knee(hR, ankleR, 1);
  const pantsLike = c.bottom === "pants";
  const lw = pantsLike ? [30, 25, 20] : [24, 20, 15.5];
  const legParts = (h, k, a, fill) => [{ d: capsule(h, lw[0], k, lw[1]), fill }, { d: capsule(k, lw[1], a, lw[2], false, pantsLike), fill }];
  const shoe = (a, s) => {
    const sneaker = c.shoes === C.ink;
    return `<g transform="translate(${P(a)}) scale(${s} 1)">` + shape("M-18 -12C-20 8 -18 24 -9 24L33 24C48 24 48 6 33 0C21 -5 14 -12 11 -22L-13 -22Z", c.shoes) +
      (sneaker ? `<path d="M-17.5 13L43 13C42 20 38 24 33 24L-9 24C-14 24 -17 20 -17.5 13Z" fill="#c3cad6"/>` + line("M14 -10l9 6M19 -15l8 5", 2.8, "#9aa3b2") : line("M-16 14H42", 2.8, "#0b0d10")) + `</g>`;
  };
  let legs = "";
  const hipBlock = `M${n1(hipC[0] - b.hw)} ${n1(hipC[1] - 26)}L${n1(hipC[0] + b.hw)} ${n1(hipC[1] - 26)}L${n1(hipC[0] + b.hw + 1)} ${n1(hipC[1] + 6)}Q${n1(hipC[0])} ${n1(hipC[1] + 34)} ${n1(hipC[0] - b.hw - 1)} ${n1(hipC[1] + 6)}Z`;
  if (pantsLike) {
    legs = shoe(ankleL, -1) + shoe(ankleR, 1) + blob([{ d: hipBlock, fill: c.bottomColor }, ...legParts(hL, kL, ankleL, c.bottomColor), ...legParts(hR, kR, ankleR, c.bottomColor)]);
    if (!sit) legs += line(`M${n1(hipC[0])} ${n1(hipC[1] + 18)}L${n1((kL[0] + kR[0]) / 2)} ${n1(hipC[1] + 64)}`, 3.6);
  } else {
    legs = blob([...legParts(hL, kL, ankleL, skin), ...legParts(hR, kR, ankleR, skin)]) + shoe(ankleL, -1) + shoe(ankleR, 1);
    if (c.bottom === "shorts") {
      const cut = (h, k) => [h[0] + (k[0] - h[0]) * 0.62, h[1] + (k[1] - h[1]) * 0.62];
      legs += blob([{ d: hipBlock, fill: c.bottomColor }, { d: capsule(hL, 31, cut(hL, kL), 29, false, true), fill: c.bottomColor }, { d: capsule(hR, 31, cut(hR, kR), 29, false, true), fill: c.bottomColor }]);
      if (!sit) legs += line(`M${n1(hipC[0])} ${n1(hipC[1] + 18)}v34`, 3.6);
    }
  }
  let skirt = "";
  if (c.bottom === "skirt") {
    const len = sit ? 96 : c.skirt, x = hipC[0], y = hipC[1], w = b.hw + 2, flare = sit ? 26 : 20 + len * 0.1;
    skirt = shape(`M${n1(x - w)} ${n1(y - 28)}L${n1(x + w)} ${n1(y - 28)}C${n1(x + w + 8)} ${n1(y + len * 0.3)} ${n1(x * 0.6 + w + flare)} ${n1(y + len * 0.7)} ${n1(x * 0.5 + w + flare)} ${n1(y + len)}Q${n1(x * 0.5)} ${n1(y + len + 12)} ${n1(x * 0.5 - w - flare)} ${n1(y + len)}C${n1(x * 0.6 - w - flare)} ${n1(y + len * 0.7)} ${n1(x - w - 8)} ${n1(y + len * 0.3)} ${n1(x - w)} ${n1(y - 28)}Z`, c.bottomColor) +
      line(`M${n1(x - w * 0.4)} ${n1(y + len * 0.45)}L${n1(x * 0.5 - (w + flare) * 0.45)} ${n1(y + len + 2)}M${n1(x + w * 0.45)} ${n1(y + len * 0.5)}L${n1(x * 0.5 + (w + flare) * 0.5)} ${n1(y + len + 2)}`, 3.2, mix(c.bottomColor, "#000000", 0.28));
  }
  // ---- torso: built in spine coordinates (u across, v up from the hips), leaning from the hips
  const T = b.torso, lean = p.lean;
  const tp = (u, v) => { const a = rad(lean); return [hipC[0] + u * Math.cos(a) + v * Math.sin(a), hipC[1] - v * Math.cos(a) + u * Math.sin(a)]; };
  const neck = tp(0, T);
  const torsoD = `M${P(tp(-20, T - 2))}C${P(tp(-b.sw * 0.7, T))} ${P(tp(-b.sw - 2, T - 6))} ${P(tp(-b.sw, T - 30))}L${P(tp(-b.cw, T * 0.56))}C${P(tp(-b.ww, T * 0.36))} ${P(tp(-b.ww, T * 0.2))} ${P(tp(-b.hw, -8))}Q${P(tp(0, -26))} ${P(tp(b.hw, -8))}C${P(tp(b.ww, T * 0.2))} ${P(tp(b.ww, T * 0.36))} ${P(tp(b.cw, T * 0.56))}L${P(tp(b.sw, T - 30))}C${P(tp(b.sw + 2, T - 6))} ${P(tp(b.sw * 0.7, T))} ${P(tp(20, T - 2))}Q${P(tp(0, T - 20))} ${P(tp(-20, T - 2))}Z`;
  const clip = `<clipPath id="${id}"><path d="${torsoD}"/></clipPath><clipPath id="${id}o"><path clip-rule="evenodd" d="M-3000 -3000h6000v6000h-6000Z${torsoD}"/></clipPath>`;
  const inTorso = (inner) => `<g clip-path="url(#${id})">${inner}</g>`;
  const topDark = mix(c.top, "#000000", c.top === CLOTH ? 0.4 : 0.22);
  let detail = "", behind = "", over = "";
  if (ex.includes("crew")) detail += line(`M${P(tp(-21, T - 3))}Q${P(tp(0, T - 23))} ${P(tp(21, T - 3))}`, 15) + line(`M${P(tp(-21, T - 3))}Q${P(tp(0, T - 23))} ${P(tp(21, T - 3))}`, 7, C.ink) + inTorso(line(`M${P(tp(-90, -14))}L${P(tp(90, -14))}`, 15, topDark, 'opacity=".55"'));
  if (ex.includes("stripes")) detail += inTorso([0.66, 0.42, 0.18].map((k) => line(`M${P(tp(-90, T * k))}L${P(tp(90, T * k))}`, 13, C.blue)).join(""));
  if (ex.includes("vneck")) detail += shape(`M${P(tp(-17, T - 4))}L${P(tp(0, T - 40))}L${P(tp(17, T - 4))}Q${P(tp(0, T - 14))} ${P(tp(-17, T - 4))}Z`, skin);
  if (ex.includes("cardigan")) detail += inTorso(shape(`M${P(tp(-15, T + 4))}L${P(tp(15, T + 4))}L${P(tp(19, -30))}L${P(tp(-19, -30))}Z`, C.ink)) + [0.62, 0.4, 0.18].map((k) => `<circle cx="${n1(tp(30, T * k)[0])}" cy="${n1(tp(30, T * k)[1])}" r="4.6" fill="${C.ink}" stroke="${C.line}" stroke-width="2.6"/>`).join("");
  if (ex.includes("collar")) detail += shape(`M${P(tp(-22, T - 2))}L${P(tp(-3, T - 30))}L${P(tp(-32, T - 26))}Z`, c.top) + shape(`M${P(tp(22, T - 2))}L${P(tp(3, T - 30))}L${P(tp(32, T - 26))}Z`, c.top);
  if (ex.includes("hood")) {
    behind += shape(`M${P(tp(-52, T - 12))}C${P(tp(-78, T + 62))} ${P(tp(78, T + 62))} ${P(tp(52, T - 12))}Z`, C.blue);
    detail += line(`M${P(tp(-11, T - 22))}L${P(tp(-13, T - 66))}M${P(tp(11, T - 22))}L${P(tp(13, T - 66))}`, 4.4, C.ink) + `<circle cx="${n1(tp(-13, T - 70)[0])}" cy="${n1(tp(-13, T - 70)[1])}" r="4" fill="${C.ink}"/><circle cx="${n1(tp(13, T - 70)[0])}" cy="${n1(tp(13, T - 70)[1])}" r="4" fill="${C.ink}"/>` +
      line(`M${P(tp(-34, T * 0.34))}Q${P(tp(0, T * 0.44))} ${P(tp(34, T * 0.34))}L${P(tp(40, 2))}M${P(tp(-34, T * 0.34))}L${P(tp(-40, 2))}`, 3.4, "#0b0d10");
  }
  if (ex.includes("apron")) {
    over += line(`M${P(tp(-34, T * 0.72))}L${P(tp(-18, T - 4))}M${P(tp(34, T * 0.72))}L${P(tp(18, T - 4))}`, 5) +
      shape(`M${P(tp(-36, T * 0.74))}L${P(tp(36, T * 0.74))}L${P(tp(40, T * 0.42))}L${P(tp(b.hw + 12, T * 0.36))}L${P(tp(b.hw + 6, -92))}Q${P(tp(0, -104))} ${P(tp(-b.hw - 6, -92))}L${P(tp(-b.hw - 12, T * 0.36))}L${P(tp(-40, T * 0.42))}Z`, C.mint) +
      line(`M${P(tp(-26, -6))}L${P(tp(26, -6))}L${P(tp(24, -44))}L${P(tp(-24, -44))}Z`, 3.4, mix(C.mint, "#000000", 0.3));
  }
  if (ex.includes("backpack")) {
    behind += shape(`M${P(tp(-b.sw - 16, T - 34))}C${P(tp(-b.sw - 18, T + 18))} ${P(tp(b.sw + 18, T + 18))} ${P(tp(b.sw + 16, T - 34))}L${P(tp(b.sw + 14, 26))}Q${P(tp(0, 6))} ${P(tp(-b.sw - 14, 26))}Z`, C.blue);
    over += [-1, 1].map((s) => line(`M${P(tp(s * 40, T - 5))}C${P(tp(s * 46, T - 40))} ${P(tp(s * 52, T - 70))} ${P(tp(s * (b.cw - 2), T * 0.5))}`, 15) + line(`M${P(tp(s * 40, T - 5))}C${P(tp(s * 46, T - 40))} ${P(tp(s * 52, T - 70))} ${P(tp(s * (b.cw - 2), T * 0.5))}`, 8, C.blue)).join("");
  }
  // a soft fold of shadow down one side, and the hem
  const fold = inTorso(`<path d="M${P(tp(b.sw + 10, T))}L${P(tp(b.cw - 15, T * 0.56))}C${P(tp(b.ww - 14, T * 0.3))} ${P(tp(b.ww - 12, T * 0.1))} ${P(tp(b.hw - 12, -30))}L${P(tp(b.hw + 20, -30))}Z" fill="${topDark}" opacity=".5"/>`);
  const neckD = capsule(tp(0, T - 10), 17, tp(0, T + 26), 15.5);
  const capR = c.sleeves === "long" ? 22 : 23;
  const caps = [-1, 1].map((s) => { const j = tp(s * (b.sw - 17), T - 27); return `<circle cx="${n1(j[0])}" cy="${n1(j[1])}" r="${capR}" fill="${c.top}"/>`; }).join("");
  const torso = blob([{ d: neckD, fill: shade(skin, 0.3) }]) + clip + shape(torsoD, c.top) + caps + fold + detail;
  // ---- arms
  const aw = c.sleeves === "long" ? [22, 18.5, 15] : [19, 16, 13];
  const sJ = (s) => tp(s * (b.sw - 17), T - 27);
  const arm = (s, [a, bb]) => { const sh = sJ(s); const e = step(sh, a, b.up); const w = step(e, bb, b.low); return [sh, e, w]; };
  const aL = arm(-1, p.armL), aR = arm(1, p.armR);
  const drawArm = (pts, s, lowAngle, kind, held, heldAngle) => {
    const [sh, e, w] = pts;
    const long = c.sleeves === "long", fill = long ? c.top : skin;
    const up = { d: capsule(sh, aw[0], e, aw[1]), fill }, fore = { d: capsule(e, aw[1], w, aw[2]), fill };
    const hc = step(w, lowAngle, 16);
    const h = `<g transform="translate(${P(w)}) rotate(${n1(-lowAngle)})">${hand(held ? "hold" : kind, skin, held ? -s : s * (Math.abs(lowAngle) > 100 ? 1 : -1))}</g>`;
    // The outline runs down both sides of the arm and round the elbow, but at the shoulder it is only
    // drawn where it leaves the body, so the arm joins the torso without a seam.
    const dk = (d, hollow) => `<path d="${d}" fill="${hollow ? "none" : C.line}" stroke="${C.line}" stroke-width="${OUT * 2}" stroke-linejoin="round" stroke-linecap="round"/>`;
    const ring = (r) => `<circle cx="${n1(sh[0])}" cy="${n1(sh[1])}" r="${r + OUT / 2}" fill="none" stroke="${C.line}" stroke-width="${OUT}" clip-path="url(#${id}o)"/>`;
    const sides = (d) => d.replace(/A[^A]*Z$/, "").replace(/Z$/, "");
    let out = dk(sides(up.d), true) + ring(aw[0]) + dk(fore.d) + `<path d="${capsule(sh, aw[0], e, aw[1], true)}" fill="${fill}"/><path d="${fore.d}" fill="${fill}"/>`;
    if (!long) {
      const cutP = [sh[0] + (e[0] - sh[0]) * 0.54, sh[1] + (e[1] - sh[1]) * 0.54];
      const slv = capsule(sh, 23, cutP, 21.5, false, true);
      out += dk(sides(slv), true) + ring(23) + `<path d="${capsule(sh, 23, cutP, 21.5, true, true)}" fill="${c.top}"/>`;
    } else out += line(`M${P(step(step(w, lowAngle + 180, 9), lowAngle + 90, aw[2] - 1))}L${P(step(step(w, lowAngle + 180, 9), lowAngle - 90, aw[2] - 1))}`, 3, mix(c.top, "#000000", c.top === CLOTH ? 0.45 : 0.3));
    return out + (held ? prop(held, hc, heldAngle, skin) : "") + h;
  };
  const headC = step(neck, 180 + lean + p.headTilt * 0.4, 60 * b.head);
  const hh = head(c, p.expr, p.look, p.headTilt, b.head);
  const hd = `<g transform="translate(${P(headC)})">${hh.front}</g>`, hairBack = `<g transform="translate(${P(headC)})">${hh.back}</g>`;
  const tote = ex.includes("tote") && !p.propL && !p.noTote ? prop("tote", [aL[2][0], aL[2][1] + 22], 0) : "";
  const benchY = n1(hipC[1] + 24);
  const stool = sit ? line(`M-104 ${benchY + 20}L-110 -4M104 ${benchY + 20}L110 -4`, 17) + line(`M-104 ${benchY + 20}L-110 -4M104 ${benchY + 20}L110 -4`, 7, "#aab3c2") + shape(`M-124 ${benchY}h248a8 8 0 0 1 8 8v8a8 8 0 0 1 -8 8h-248a8 8 0 0 1 -8 -8v-8a8 8 0 0 1 8 -8Z`, "#c9d0dc") : "";
  const body = [
    stool, behind, hairBack, legs, skirt, torso, over, hd,
    tote && "", drawArm(aL, -1, p.armL[1], p.handL, p.propL, p.propAngleL), tote,
    drawArm(aR, 1, p.armR[1], p.handR, p.propR, p.propAngleR),
  ].join("");
  const sc = (opts.scale ?? 1) * c.scale;
  return `<g transform="translate(${opts.x ?? 0} ${opts.y ?? 0}) scale(${opts.flip ? -sc : sc} ${sc})">${body}</g>`;
}
