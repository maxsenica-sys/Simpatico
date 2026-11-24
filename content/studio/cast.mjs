// The cast, drawn by code: one skeleton, eight costumes. A pose is a set of joint angles, so
// faces and proportions cannot drift between posts. figure(pose) returns an SVG <g> whose origin
// is the ground under the figure's feet; 700 units tall for a standing adult.
export const C = { dark: "#0b0d10", ink: "#f4f5f7", blue: "#5b8cff", mint: "#5fe0bd", line: "#0b0d10" };
const OUT = 7; // outline weight
const rad = (d) => (d * Math.PI) / 180;
// Angles: 0 = straight down, 90 = towards screen right, -90 = screen left, 180 = straight up.
const step = ([x, y], angle, len) => [x + Math.sin(rad(angle)) * len, y + Math.cos(rad(angle)) * len];
const P = (p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
/** A limb as a fat rounded stroke with an outline: drawn twice, dark underneath. */
const limb = (pts, w, fill) =>
  `<path d="M${pts.map(P).join("L")}" fill="none" stroke="${C.line}" stroke-width="${w + OUT * 2}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="M${pts.map(P).join("L")}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const shape = (d, fill, extra = "") => `<path d="${d}" fill="${fill}" stroke="${C.line}" stroke-width="${OUT}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
const stroke = (d, w = OUT, extra = "") => `<path d="${d}" fill="none" stroke="${C.line}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;

const ARM = 42, LEG = 56;

// ------------------------------------------------------------------ costumes
export const CAST = {
  traveller: { top: C.mint, sleeves: "short", bottom: "shorts", bottomColor: C.dark, shoes: C.ink, hair: "short", hairColor: C.dark, extras: ["backpack", "sunnies"], scale: 1 },
  grandma: { top: C.blue, sleeves: "long", bottom: "skirt", bottomColor: C.dark, shoes: C.dark, hair: "bun", hairColor: C.ink, extras: ["glasses", "cardigan"], scale: 0.9 },
  grandkid: { top: C.ink, sleeves: "short", bottom: "shorts", bottomColor: C.blue, shoes: C.dark, hair: "kid", hairColor: C.dark, extras: ["collar"], scale: 0.68 },
  "partner-a": { top: C.blue, sleeves: "long", bottom: "pants", bottomColor: C.dark, shoes: C.ink, hair: "cap", hairColor: C.dark, extras: ["stripe"], scale: 1.02 },
  "partner-b": { top: C.mint, sleeves: "long", bottom: "pants", bottomColor: C.dark, shoes: C.ink, hair: "long", hairColor: C.dark, extras: ["hoops"], scale: 0.96 },
  student: { top: C.dark, sleeves: "long", bottom: "pants", bottomColor: C.blue, shoes: C.ink, hair: "fringe", hairColor: C.dark, extras: ["hood"], scale: 0.97 },
  shopkeeper: { top: C.ink, sleeves: "short", bottom: "pants", bottomColor: C.dark, shoes: C.dark, hair: "bald", hairColor: C.dark, extras: ["apron", "moustache"], scale: 1 },
  newcomer: { top: C.ink, sleeves: "long", bottom: "skirt", bottomColor: C.mint, shoes: C.dark, hair: "ponytail", hairColor: C.dark, extras: ["tote"], scale: 0.95 },
};

// ------------------------------------------------------------------ faces
function face(expr, look = [0, 0]) {
  const [lx, ly] = look;
  const ex = 17, ey = -8 + ly * 4, ox = lx * 6;
  let eyes = `<circle cx="${-ex + ox}" cy="${ey}" r="5.2" fill="${C.line}"/><circle cx="${ex + ox}" cy="${ey}" r="5.2" fill="${C.line}"/>`;
  let brows = "", mouth = "";
  const m = (d) => stroke(d, 5.5);
  switch (expr) {
    case "grin": mouth = `<path d="M-15 12Q0 32 15 12Z" fill="${C.line}"/>`; break;
    case "laugh":
      eyes = stroke(`M${-ex - 7} ${ey + 2}Q${-ex} ${ey - 7} ${-ex + 7} ${ey + 2}`, 5) + stroke(`M${ex - 7} ${ey + 2}Q${ex} ${ey - 7} ${ex + 7} ${ey + 2}`, 5);
      mouth = `<path d="M-17 10Q0 40 17 10Z" fill="${C.line}"/>`; break;
    case "flat": mouth = m("M-10 18H10"); break;
    case "sad": mouth = m("M-11 22Q0 12 11 22"); brows = stroke(`M${-ex - 8} ${ey - 16}L${-ex + 7} ${ey - 20}`, 5) + stroke(`M${ex + 8} ${ey - 16}L${ex - 7} ${ey - 20}`, 5); break;
    case "worried": mouth = m("M-9 21Q0 15 9 21"); brows = stroke(`M${-ex - 8} ${ey - 15}L${-ex + 7} ${ey - 21}`, 5) + stroke(`M${ex + 8} ${ey - 15}L${ex - 7} ${ey - 21}`, 5); break;
    case "o": mouth = `<ellipse cx="0" cy="19" rx="7" ry="9" fill="${C.line}"/>`; brows = stroke(`M${-ex - 7} ${ey - 19}h14`, 5) + stroke(`M${ex - 7} ${ey - 19}h14`, 5); break;
    case "confused": mouth = m("M-10 20Q-3 14 3 19T12 17"); brows = stroke(`M${-ex - 8} ${ey - 20}L${-ex + 7} ${ey - 15}`, 5) + stroke(`M${ex - 7} ${ey - 21}h15`, 5); break;
    case "eyeroll":
      eyes = `<circle cx="${-ex}" cy="${ey}" r="9" fill="${C.ink}" stroke="${C.line}" stroke-width="4"/><circle cx="${ex}" cy="${ey}" r="9" fill="${C.ink}" stroke="${C.line}" stroke-width="4"/><circle cx="${-ex + 2}" cy="${ey - 5}" r="4" fill="${C.line}"/><circle cx="${ex + 2}" cy="${ey - 5}" r="4" fill="${C.line}"/>`;
      mouth = m("M-9 20H9"); break;
    case "relief":
      eyes = stroke(`M${-ex - 7} ${ey - 2}Q${-ex} ${ey + 6} ${-ex + 7} ${ey - 2}`, 5) + stroke(`M${ex - 7} ${ey - 2}Q${ex} ${ey + 6} ${ex + 7} ${ey - 2}`, 5);
      mouth = m("M-11 14Q0 25 11 14"); break;
    default: mouth = m("M-12 14Q0 26 12 14"); // smile
  }
  return eyes + brows + mouth;
}

// ------------------------------------------------------------------ hair and heads
function head(c, expr, look, tilt) {
  const R = 50; // head radius
  let back = "", front = "", acc = "";
  const hc = c.hairColor;
  switch (c.hair) {
    case "long":
      back = shape(`M-56 -8C-62 -70 62 -70 56 -8C60 40 66 70 54 96L-54 96C-66 70 -60 40 -56 -8Z`, hc);
      front = shape(`M-51 -6C-52 -50 -20 -58 0 -40C20 -58 52 -50 51 -6C40 -22 20 -30 0 -30C-20 -30 -40 -22 -51 -6Z`, hc);
      break;
    case "bun":
      back = shape(`M-22 -62a22 20 0 1 1 44 0a22 20 0 1 1 -44 0Z`, hc);
      front = shape(`M-51 -4C-56 -48 -24 -58 0 -56C24 -58 56 -48 51 -4C44 -26 24 -36 0 -36C-24 -36 -44 -26 -51 -4Z`, hc);
      break;
    case "ponytail":
      back = shape(`M34 -40C78 -40 84 20 62 62C58 30 52 6 30 -8Z`, hc);
      front = shape(`M-51 -4C-56 -50 -22 -58 0 -56C24 -58 56 -48 51 -4C46 -28 26 -40 -4 -34C-26 -32 -44 -24 -51 -4Z`, hc);
      break;
    case "fringe":
      front = shape(`M-52 2C-60 -52 -24 -60 0 -58C26 -60 60 -50 52 2C48 -14 40 -22 30 -24C10 -14 -22 -14 -40 -24C-46 -18 -50 -10 -52 2Z`, hc);
      break;
    case "kid":
      front = shape(`M-51 0C-58 -54 -22 -60 0 -58C24 -60 58 -52 51 0C46 -22 34 -30 16 -30C8 -24 -6 -24 -14 -32C-32 -30 -46 -20 -51 0Z`, hc);
      break;
    case "short":
      front = shape(`M-51 -6C-56 -52 -22 -60 0 -58C24 -60 56 -50 51 -6C42 -28 22 -38 0 -36C-22 -38 -42 -28 -51 -6Z`, hc);
      break;
    case "cap":
      front = shape(`M-52 -14C-56 -56 -24 -62 0 -62C24 -62 56 -56 52 -14Z`, C.dark) + shape(`M-58 -16Q0 -34 58 -16Q60 -4 52 -2Q0 -20 -52 -2Q-60 -4 -58 -16Z`, C.blue);
      break;
    case "bald":
      front = stroke(`M-50 -8C-52 -18 -48 -26 -44 -32`, 5) + stroke(`M50 -8C52 -18 48 -26 44 -32`, 5);
      break;
  }
  const ex = c.extras || [];
  if (ex.includes("glasses")) acc += `<circle cx="-18" cy="-8" r="13" fill="none" stroke="${C.line}" stroke-width="4.5"/><circle cx="18" cy="-8" r="13" fill="none" stroke="${C.line}" stroke-width="4.5"/>` + stroke("M-5 -8h10", 4.5) + stroke("M31 -4C40 6 44 22 40 40", 3.5) + stroke("M-31 -4C-40 6 -44 22 -40 40", 3.5);
  if (ex.includes("sunnies")) acc += shape(`M-32 -54h26v10a13 11 0 0 1 -26 0Z`, C.blue) + shape(`M6 -54h26v10a13 11 0 0 1 -26 0Z`, C.blue) + stroke("M-6 -50h12", 4.5);
  if (ex.includes("hoops")) acc += `<circle cx="-52" cy="22" r="9" fill="none" stroke="${C.line}" stroke-width="4.5"/><circle cx="52" cy="22" r="9" fill="none" stroke="${C.line}" stroke-width="4.5"/>`;
  if (ex.includes("moustache")) acc += `<path d="M-20 10Q-8 0 0 8Q8 0 20 10Q8 16 0 12Q-8 16 -20 10Z" fill="${C.line}"/>`;
  const skull = `<circle r="${R}" fill="${C.ink}" stroke="${C.line}" stroke-width="${OUT}"/>`;
  const ears = `<circle cx="-50" cy="2" r="9" fill="${C.ink}" stroke="${C.line}" stroke-width="${OUT}"/><circle cx="50" cy="2" r="9" fill="${C.ink}" stroke="${C.line}" stroke-width="${OUT}"/>`;
  const f = ex.includes("moustache") && ["smile", undefined].includes(expr) ? face("flat", look).replace(/<path d="M-10 18H10"[^>]*>/, "") : face(expr, look);
  return `<g transform="rotate(${tilt}) scale(1.2)">${back}${ears}${skull}${f}${front}${acc}</g>`;
}

// ------------------------------------------------------------------ props
function prop(kind, at, angle) {
  const [x, y] = at;
  const g = (inner) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle})">${inner}</g>`;
  if (kind === "phone") return g(`<rect x="-19" y="-58" width="38" height="70" rx="8" fill="${C.dark}" stroke="${C.line}" stroke-width="${OUT}"/><rect x="-13" y="-51" width="26" height="54" rx="3" fill="${C.mint}"/>`);
  if (kind === "phone-back") return g(`<rect x="-19" y="-58" width="38" height="70" rx="8" fill="${C.dark}" stroke="${C.line}" stroke-width="${OUT}"/><circle cx="-7" cy="-45" r="4.5" fill="${C.ink}"/>`);
  if (kind === "letter") return g(`<rect x="-30" y="-74" width="60" height="78" rx="4" fill="${C.ink}" stroke="${C.line}" stroke-width="${OUT}"/>` + stroke("M-18 -56h36M-18 -42h36M-18 -28h22", 4.5));
  if (kind === "cup") return g(`<path d="M-16 -44h32l-5 44h-22Z" fill="${C.ink}" stroke="${C.line}" stroke-width="${OUT}" stroke-linejoin="round"/>`);
  if (kind === "laptop") return g(`<path d="M-70 -84h140v80h-140Z" fill="${C.dark}" stroke="${C.line}" stroke-width="${OUT}" stroke-linejoin="round"/><rect x="-60" y="-75" width="120" height="62" rx="3" fill="${C.blue}"/><path d="M-84 -4h168v14a6 6 0 0 1 -6 6h-156a6 6 0 0 1 -6 -6Z" fill="${C.ink}" stroke="${C.line}" stroke-width="${OUT}" stroke-linejoin="round"/>`);
  if (kind === "table-phone") return g(`<rect x="-46" y="-18" width="92" height="30" rx="9" fill="${C.dark}" stroke="${C.line}" stroke-width="${OUT}"/><rect x="-38" y="-12" width="36" height="18" rx="3" fill="${C.mint}"/><rect x="2" y="-12" width="36" height="18" rx="3" fill="${C.blue}"/>`);
  if (kind === "tote") return g(stroke("M-18 0C-18 -40 18 -40 18 0", 6) + shape("M-34 0h68l-6 78h-56Z", C.blue));
  return "";
}

// ------------------------------------------------------------------ the figure
/**
 * pose: { armL:[upper,lower], armR:[upper,lower], legL:[thigh,shin], legR:[thigh,shin], lean, headTilt, look,
 *         expr, sit, propL, propR, propAngleL, propAngleR }
 */
export function figure(who, pose = {}, opts = {}) {
  const c = CAST[who];
  const p = { armL: [-8, -4], armR: [8, 4], legL: [-4, -2], legR: [4, 2], lean: 0, headTilt: 0, look: [0, 0], expr: "smile", ...pose };
  const sit = !!p.sit;
  const THIGH = 128, SHIN = 124, TORSO = 176, UP = 100, LOW = 96;
  // hips
  const hipY = sit ? -(SHIN + 6) : -(THIGH + SHIN + 6) + (p.crouch || 0);
  const hipC = [0, hipY];
  const hL = [-34, hipY], hR = [34, hipY];
  const legs = (h, [a, b]) => {
    const knee = step(h, sit ? (a || 0) + (h[0] < 0 ? -78 : 78) * (p.sitSide ?? 0) + (p.sitFront ? 0 : 0) : a, sit ? THIGH * 0.42 : THIGH);
    const ankle = step(knee, b, SHIN);
    return [h, knee, ankle];
  };
  const lL = legs(hL, p.legL), lR = legs(hR, p.legR);
  // spine
  const neck = step(hipC, 180 + p.lean, TORSO);
  const sAng = p.lean;
  const off = (base, dx, dy) => [base[0] + dx * Math.cos(rad(sAng)) + dy * Math.sin(rad(sAng)), base[1] - dx * Math.sin(rad(sAng)) + dy * Math.cos(rad(sAng))];
  const sL = off(neck, -74, 30), sR = off(neck, 74, 30);
  const arm = (s, [a, b]) => { const e = step(s, a, UP); const w = step(e, b, LOW); return [s, e, w]; };
  const aL = arm(sL, p.armL), aR = arm(sR, p.armR);
  const headC = step(neck, 180 + p.lean + p.headTilt * 0.4, 70);

  const shoe = (ankle, dir) => shape(`M${ankle[0] - 20} ${ankle[1] - 4}h${40 + 18 * Math.abs(dir)}a16 16 0 0 1 0 32h${-(40 + 18 * Math.abs(dir)) - 0}a16 16 0 0 1 0 -32Z`.replace(/h(-?\d+)/, (m) => m), c.shoes, dir < 0 ? `transform="translate(${2 * ankle[0]} 0) scale(-1 1)"` : "");
  const drawLeg = (pts, side) => {
    const skin = C.ink;
    let s = "";
    if (c.bottom === "pants") s += limb(pts, LEG, c.bottomColor);
    else if (c.bottom === "shorts") s += limb(pts, LEG - 8, skin) + limb([pts[0], [pts[0][0] + (pts[1][0] - pts[0][0]) * 0.55, pts[0][1] + (pts[1][1] - pts[0][1]) * 0.55]], LEG + 4, c.bottomColor);
    else s += limb(pts, LEG - 12, skin);
    const a = pts[2];
    s += limb([[a[0] - side * 4, a[1] + 8], [a[0] + side * 30, a[1] + 8]], 34, c.shoes);
    return s;
  };
  const drawArm = (pts, hasProp) => {
    const [s, e, w] = pts;
    let out = "";
    if (c.sleeves === "long") out += limb([s, e, w], ARM, c.top === C.ink && (c.extras || []).includes("cardigan") ? C.blue : c.top);
    else out += limb([e, w], ARM - 8, C.ink) + limb([s, e], ARM + 2, c.top) ;
    if (c.sleeves !== "long") out = limb([s, e, w], ARM - 8, C.ink) + limb([s, [s[0] + (e[0] - s[0]) * 0.6, s[1] + (e[1] - s[1]) * 0.6]], ARM + 2, c.top);
    out += `<circle cx="${w[0].toFixed(1)}" cy="${w[1].toFixed(1)}" r="23" fill="${C.ink}" stroke="${C.line}" stroke-width="${OUT}"/>`;
    return out;
  };

  // torso
  const waistL = [hipC[0] - 62, hipC[1] + 10], waistR = [hipC[0] + 62, hipC[1] + 10];
  const shL = off(neck, -86, 34), shR = off(neck, 86, 34);
  const nkL = off(neck, -26, 6), nkR = off(neck, 26, 6);
  let torso = shape(`M${P(nkL)}Q${P(off(neck, -80, 4))} ${P(shL)}L${P(waistL)}Q${P([hipC[0], hipC[1] + 26])} ${P(waistR)}L${P(shR)}Q${P(off(neck, 80, 4))} ${P(nkR)}Q${P(off(neck, 0, 22))} ${P(nkL)}Z`, c.top);
  const ex = c.extras || [];
  if (ex.includes("stripe")) torso += stroke(`M${P(off(neck, -78, 78))}L${P(off(neck, 78, 78))}`, 16, `stroke="${C.ink}"`).replace(`stroke="${C.line}"`, "").replace("fill=\"none\"", `fill="none"`);
  if (ex.includes("cardigan")) torso += stroke(`M${P(off(neck, -12, 16))}L${P([hipC[0] - 6, hipC[1] + 14])}M${P(off(neck, 12, 16))}L${P([hipC[0] + 6, hipC[1] + 14])}`, 5);
  if (ex.includes("collar")) torso += shape(`M${P(off(neck, -24, 8))}L${P(off(neck, 0, 34))}L${P(off(neck, 24, 8))}L${P(off(neck, 10, 2))}L${P(off(neck, 0, 14))}L${P(off(neck, -10, 2))}Z`, C.blue);
  if (ex.includes("hood")) torso += stroke(`M${P(off(neck, -10, 30))}v44M${P(off(neck, 10, 30))}v44`, 5, `stroke="${C.ink}"`) ;
  if (ex.includes("apron")) torso += shape(`M${P(off(neck, -42, 66))}L${P(off(neck, 42, 66))}L${hipC[0] + 56} ${hipC[1] + 96}L${hipC[0] - 56} ${hipC[1] + 96}Z`, C.mint) + stroke(`M${P(off(neck, -42, 66))}L${P(off(neck, -20, 10))}M${P(off(neck, 42, 66))}L${P(off(neck, 20, 10))}`, 5);
  let skirt = "";
  if (c.bottom === "skirt" || c.bottom === "dress") {
    const len = sit ? 80 : 150;
    skirt = shape(`M${hipC[0] - 62} ${hipC[1] - 4}L${hipC[0] + 62} ${hipC[1] - 4}L${hipC[0] + 86} ${hipC[1] + len}L${hipC[0] - 86} ${hipC[1] + len}Z`, c.bottomColor);
  }
  let backpack = "";
  if (ex.includes("backpack")) backpack = shape(`M${P(off(neck, -96, 30))}h192v${130}a24 24 0 0 1 -24 24h-144a24 24 0 0 1 -24 -24Z`, C.blue) ;
  const hoodBack = ex.includes("hood") ? shape(`M${P(off(neck, -70, 36))}C${P(off(neck, -104, -84))} ${P(off(neck, 104, -84))} ${P(off(neck, 70, 36))}Z`, c.top === C.dark ? C.blue : c.top) : "";
  const neckShape = limb([off(neck, 0, 14), step(neck, 180 + p.lean, 26)], 34, C.ink);
  const straps = ex.includes("backpack") ? stroke(`M${P(off(neck, -52, 14))}L${P(off(neck, -56, 124))}M${P(off(neck, 52, 14))}L${P(off(neck, 56, 124))}`, 12, `stroke="${C.blue}"`).replace(/stroke="#0b0d10" /, "") : "";

  const propAt = (pts, kind, ang) => (kind ? prop(kind, pts[2], ang ?? 0) : "");
  const order = [
    backpack,
    hoodBack,
    drawLeg(lL, -1), drawLeg(lR, 1),
    skirt,
    neckShape,
    torso, straps,
    p.armBehind === "L" ? "" : "",
    `<g transform="translate(${headC[0].toFixed(1)} ${headC[1].toFixed(1)})">${head(c, p.expr, p.look, p.headTilt)}</g>`,
    drawArm(aL), propAt(aL, p.propL, p.propAngleL),
    drawArm(aR), propAt(aR, p.propR, p.propAngleR),
    ex.includes("tote") && !p.propL && !p.noTote ? prop("tote", [aL[2][0], aL[2][1] + 4], 0) : "",
  ].join("");
  const sc = (opts.scale ?? 1) * c.scale;
  const stool = sit ? `<rect x="-70" y="${hipY + 20}" width="140" height="22" rx="8" fill="${C.dark}" stroke="${C.line}" stroke-width="${OUT}"/><path d="M-50 ${hipY + 42}L-60 0M50 ${hipY + 42}L60 0" stroke="${C.line}" stroke-width="12" stroke-linecap="round"/>` : "";
  return `<g transform="translate(${opts.x ?? 0} ${opts.y ?? 0}) scale(${opts.flip ? -sc : sc} ${sc})">${stool}${order}</g>`;
}
