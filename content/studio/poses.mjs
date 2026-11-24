// The pose library: every name the queue uses (content/RULES.md). Each is a function of
// {x, y, scale, flip} returning SVG. Angles: 0 = down, 90 = screen right, -90 = left, 180 = up.
import { figure, C } from "./cast.mjs";
const pose = (who, p) => (o = {}) => figure(who, p, o);
const EAR_R = { armR: [128, -112], propR: "phone", propAngleR: -8 };
const EAR_L = { armL: [-128, 112], propL: "phone", propAngleL: 8 };
const BOTH_HOLD = { armR: [22, -72], armL: [-22, 72] };
const LAUGH = { armR: [24, -62], armL: [-24, 62], expr: "laugh", headTilt: -7, lean: -3 };
const group = (...parts) => (o = {}) => {
  const sc = o.scale ?? 1;
  return `<g transform="translate(${o.x ?? 0} ${o.y ?? 0}) scale(${o.flip ? -sc : sc} ${sc})">${parts.map((f) => f()).join("")}</g>`;
};
const at = (who, p, x, extra = {}) => () => figure(who, p, { x, y: 0, ...extra });
export const POSES = {
  "traveller-lost": pose("traveller", { armR: [50, -168], armL: [-30, -100], propL: "letter", expr: "worried", look: [-0.6, 0.6] }),
  "traveller-phone-up": pose("traveller", { armR: [78, 100], armL: [-10, -6], propR: "phone", propAngleR: 12, expr: "grin", look: [0.7, 0] }),
  "traveller-laughing": pose("traveller", LAUGH),
  "traveller-pointing": pose("traveller", { armR: [96, 92], armL: [-10, -6], expr: "grin", look: [0.8, 0] }),
  "grandma-on-phone": pose("grandma", { ...EAR_R, armL: [-12, 30], expr: "grin", headTilt: 6 }),
  "grandma-confused": pose("grandma", { armR: [40, -160], armL: [-14, 20], expr: "confused", headTilt: -8 }),
  "grandma-smiling": pose("grandma", { armL: [-20, 40], armR: [20, -40], expr: "grin" }),
  "grandma-waving": pose("grandma", { armR: [122, 172], armL: [-12, 24], expr: "laugh", headTilt: 5 }),
  "grandkid-waving": pose("grandkid", { armR: [120, 170], armL: [-10, -6], expr: "grin", headTilt: 6 }),
  "grandkid-reading-phone": pose("grandkid", { ...BOTH_HOLD, propR: "phone-back", propAngleR: 0, look: [0, 1], expr: "smile", headTilt: 0 }),
  "grandkid-shrugging": pose("grandkid", { armR: [58, 118], armL: [-58, -118], expr: "confused", headTilt: -6 }),
  "partner-a-on-call": pose("partner-a", { ...EAR_R, armL: [-10, -6], expr: "grin", headTilt: 5 }),
  "partner-a-confused": pose("partner-a", { armR: [50, -168], armL: [-34, 30], expr: "confused", headTilt: -8 }),
  "partner-a-laughing": pose("partner-a", LAUGH),
  "partner-a-reading-phone": pose("partner-a", { armR: [28, 142], armL: [-12, -6], propR: "phone-back", propAngleR: -10, look: [0.7, 0.8], expr: "smile", headTilt: 7 }),
  "partner-b-on-call": pose("partner-b", { ...EAR_L, armR: [10, 6], expr: "grin", headTilt: -5 }),
  "partner-b-reading-phone": pose("partner-b", { armL: [-28, -142], armR: [12, 6], propL: "phone-back", propAngleL: 10, look: [-0.7, 0.8], expr: "smile", headTilt: -7 }),
  "partner-b-laughing": pose("partner-b", LAUGH),
  "partner-b-rolling-eyes": pose("partner-b", { armR: [26, -78], armL: [-26, 78], expr: "eyeroll", headTilt: 8 }),
  "student-homesick": pose("student", { sit: true, lean: 6, headTilt: 12, armR: [14, -24], armL: [-14, 24], legL: [-34, 0], legR: [34, 0], expr: "sad", look: [0, 1] }),
  "student-on-call": pose("student", { ...EAR_R, armL: [-10, -6], expr: "grin", headTilt: 5 }),
  "student-studying": pose("student", { sit: true, armR: [26, -66], armL: [-26, 66], legL: [-34, 0], legR: [34, 0], propR: "laptop", propAngleR: 0, expr: "flat", look: [0, 1], laptop: true }),
  "student-relieved": pose("student", { armR: [34, -128], armL: [-10, -6], expr: "relief", headTilt: -5 }),
  "shopkeeper-talking": pose("shopkeeper", { armR: [60, 120], armL: [-20, -30], expr: "grin" }),
  "shopkeeper-pointing": pose("shopkeeper", { armR: [96, 92], armL: [-52, 46], expr: "grin", look: [0.8, 0] }),
  "shopkeeper-smiling": pose("shopkeeper", { armR: [52, -46], armL: [-52, 46], expr: "grin" }),
  "newcomer-worried": pose("newcomer", { armR: [40, -160], armL: [-10, -4], expr: "worried", headTilt: 6 }),
  "newcomer-relieved": pose("newcomer", { armR: [34, -128], armL: [-10, -4], expr: "relief", headTilt: -5 }),
  "newcomer-reading-letter": pose("newcomer", { ...BOTH_HOLD, propR: "letter", propAngleR: 0, noTote: true, look: [0, 1], expr: "worried" }),
  // Pairs (about 560 wide at scale 1).
  "two-people-one-phone": group(
    at("traveller", { armR: [70, 96], armL: [-10, -6], expr: "grin", look: [0.8, 0.5] }, -170),
    at("shopkeeper", { armL: [-70, -96], armR: [20, 10], expr: "laugh", look: [-0.8, 0.5] }, 170),
    () => `<g transform="translate(0 -372)"><rect x="-24" y="-44" width="48" height="88" rx="10" fill="${C.dark}" stroke="${C.line}" stroke-width="7"/><rect x="-17" y="-36" width="34" height="34" rx="3" fill="${C.mint}"/><rect x="-17" y="2" width="34" height="34" rx="3" fill="${C.blue}"/></g>`,
  ),
  "family-group-call": group(
    at("grandma", { armR: [122, 172], armL: [-12, 24], expr: "laugh", headTilt: 5 }, -215),
    at("grandkid", { armR: [120, 170], armL: [-10, -6], expr: "grin" }, 0),
    at("partner-b", { armL: [-118, -176], armR: [10, 6], propL: "phone-back", propAngleL: 0, expr: "grin", look: [-0.6, -0.4] }, 205),
  ),
  "friends-cheers": group(
    at("traveller", { armR: [108, 150], armL: [-10, -6], propR: "cup", propAngleR: 8, expr: "laugh" }, -205),
    at("student", { armL: [-108, -150], armR: [10, 6], propL: "cup", propAngleL: -8, expr: "laugh" }, 205),
  ),
};
