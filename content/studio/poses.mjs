// The pose library: every name the queue uses (content/RULES.md). Each is a function of
// {x, y, scale, flip} returning SVG. Angles: 0 = down, 90 = screen right, -90 = left, 180 = up.
// "R" is the arm on the right of the picture.
import { figure, C } from "./cast.mjs";
const pose = (who, p) => (o = {}) => figure(who, p, o);
const EAR_R = { armR: [66, -154], propR: "phone", propAngleR: -10 };
const EAR_L = { armL: [-66, 154], propL: "phone", propAngleL: 10 };
const READ_R = { armR: [20, -112], propR: "phone-back", propAngleR: -6, look: [-0.2, 1] };
const READ_L = { armL: [-20, 112], propL: "phone-back", propAngleL: 6, look: [0.2, 1] };
const LAUGH = { armR: [26, -64], armL: [-30, 50], expr: "laugh", headTilt: -8, lean: -4, shift: 5 };
const WAVE_R = { armR: [122, 176], handR: "wave" };
const SCRATCH_R = { armR: [120, -140] }; // hand to the side of the head
const CHIN_R = { armR: [-6, -172] }; // hand to the chin
const group = (...parts) => (o = {}) => {
  const sc = o.scale ?? 1;
  return `<g transform="translate(${o.x ?? 0} ${o.y ?? 0}) scale(${o.flip ? -sc : sc} ${sc})">${parts.map((f) => f()).join("")}</g>`;
};
const at = (who, p, x) => () => figure(who, p, { x, y: 0 });
export const POSES = {
  "traveller-lost": pose("traveller", { ...SCRATCH_R, armL: [-34, -112], propL: "letter", propAngleL: -8, expr: "worried", look: [-0.7, 0.5], headTilt: -5, shift: -5 }),
  "traveller-phone-up": pose("traveller", { armR: [72, 112], propR: "phone", propAngleR: 8, armL: [-12, -4], expr: "grin", look: [0.8, -0.1], shift: -5, lean: 2 }),
  "traveller-laughing": pose("traveller", LAUGH),
  "traveller-pointing": pose("traveller", { armR: [94, 90], handR: "point", armL: [-14, 20], expr: "grin", look: [0.9, 0], shift: -6, lean: 3 }),
  "grandma-on-phone": pose("grandma", { ...EAR_R, armL: [-16, 34], expr: "grin", headTilt: 7, shift: -4 }),
  "grandma-confused": pose("grandma", { ...CHIN_R, armL: [-16, 26], expr: "confused", headTilt: -8, look: [0.3, -0.3] }),
  "grandma-smiling": pose("grandma", { armL: [-24, 52], armR: [24, -52], expr: "grin", headTilt: 4 }),
  "grandma-waving": pose("grandma", { ...WAVE_R, armL: [-16, 30], expr: "laugh", headTilt: 6, shift: -4 }),
  "grandkid-waving": pose("grandkid", { ...WAVE_R, armL: [-14, -4], expr: "grin", headTilt: 7, shift: -4 }),
  "grandkid-reading-phone": pose("grandkid", { ...READ_R, armL: [-22, 100], expr: "smile" }),
  "grandkid-shrugging": pose("grandkid", { armR: [56, 124], armL: [-56, -124], handR: "wave", handL: "wave", expr: "confused", headTilt: -7 }),
  "partner-a-on-call": pose("partner-a", { ...EAR_R, armL: [-12, -4], expr: "grin", headTilt: 6, shift: -5 }),
  "partner-a-confused": pose("partner-a", { ...SCRATCH_R, armL: [-14, -2], expr: "confused", headTilt: -8, look: [0.3, -0.3], shift: 4 }),
  "partner-a-laughing": pose("partner-a", LAUGH),
  "partner-a-reading-phone": pose("partner-a", { ...READ_R, armL: [-12, -4], expr: "smile", headTilt: 4, shift: 5 }),
  "partner-b-on-call": pose("partner-b", { ...EAR_L, armR: [14, -30], expr: "grin", headTilt: -6, shift: 5 }),
  "partner-b-reading-phone": pose("partner-b", { ...READ_L, armR: [12, 4], expr: "smile", headTilt: -4, shift: -5 }),
  "partner-b-laughing": pose("partner-b", LAUGH),
  "partner-b-rolling-eyes": pose("partner-b", { armR: [28, -80], armL: [-28, 80], expr: "eyeroll", headTilt: 9, shift: 6 }),
  "student-homesick": pose("student", { sit: true, lean: 5, headTilt: 12, armR: [18, -30], armL: [-18, 30], expr: "sad", look: [0, 1] }),
  "student-on-call": pose("student", { ...EAR_R, armL: [-12, -4], expr: "grin", headTilt: 6, shift: -5 }),
  "student-studying": pose("student", { sit: true, armR: [28, -70], armL: [-28, 70], propR: "laptop", propAngleR: 0, expr: "flat", look: [0, 1] }),
  "student-relieved": pose("student", { armR: [30, -124], armL: [-12, -4], expr: "relief", headTilt: -6, shift: 4 }),
  "shopkeeper-talking": pose("shopkeeper", { armR: [58, 122], handR: "wave", armL: [-24, -40], expr: "grin", headTilt: 4 }),
  "shopkeeper-pointing": pose("shopkeeper", { armR: [94, 90], handR: "point", armL: [-50, 48], expr: "grin", look: [0.9, 0], lean: 3 }),
  "shopkeeper-smiling": pose("shopkeeper", { armR: [50, -48], armL: [-50, 48], expr: "grin" }),
  "newcomer-worried": pose("newcomer", { armR: [24, -72], armL: [-12, -2], expr: "worried", headTilt: 6, look: [-0.3, 0.3] }),
  "newcomer-relieved": pose("newcomer", { armR: [30, -124], armL: [-12, -2], expr: "relief", headTilt: -6, shift: 4 }),
  "newcomer-reading-letter": pose("newcomer", { armR: [22, -104], armL: [-22, 104], propR: "letter", propAngleR: -4, noTote: true, look: [0, 1], expr: "worried" }),
  // Pairs (about 560 wide at scale 1).
  "two-people-one-phone": group(
    () => `<g transform="translate(0 -322)"><rect x="-29" y="-50" width="58" height="100" rx="12" fill="#272d3a" stroke="${C.line}" stroke-width="5.5"/><rect x="-21" y="-41" width="42" height="38" rx="4" fill="${C.mint}"/><rect x="-21" y="3" width="42" height="38" rx="4" fill="${C.blue}"/></g>`,
    at("traveller", { armR: [20, 113], handR: "hold", armL: [-12, -4], expr: "grin", look: [0.9, 0.4], shift: 5 }, -185),
    at("shopkeeper", { armL: [-20, -113], handL: "hold", armR: [16, 6], expr: "laugh", look: [-0.9, 0.4], shift: -5 }, 185),
  ),
  "family-group-call": group(
    at("grandma", { ...WAVE_R, armL: [-16, 30], expr: "laugh", headTilt: 6 }, -205),
    at("grandkid", { ...WAVE_R, armL: [-14, -4], expr: "grin", headTilt: -4 }, 0),
    at("partner-b", { armL: [-116, -172], armR: [12, 4], propL: "phone-back", propAngleL: 0, expr: "grin", look: [-0.6, -0.4] }, 200),
  ),
  "friends-cheers": group(
    at("traveller", { armR: [112, 150], armL: [-12, -4], propR: "cup", propAngleR: 10, expr: "laugh", lean: 2 }, -180),
    at("student", { armL: [-112, -150], armR: [12, 4], propL: "cup", propAngleL: -10, expr: "laugh", lean: -2 }, 180),
  ),
};
