// "Someone's waiting" notifications: who gets told, who doesn't. Run: npx tsx test/push.test.ts
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "push-"));
const keys = (await import("web-push")).default.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = keys.publicKey;
process.env.VAPID_PRIVATE_KEY = keys.privateKey;

const webpush = (await import("web-push")).default;
const sent: { endpoint: string; body: string }[] = [];
(webpush as unknown as { sendNotification: unknown }).sendNotification = async (sub: { endpoint: string }, payload: string) => {
  sent.push({ endpoint: sub.endpoint, body: JSON.parse(payload).body });
  return { statusCode: 201 };
};
const { pushSubscribe, notifyWaiting, pushUnsubscribe, noteSeat } = await import("../server/push");

let ip = 0;
async function call(fn: typeof pushSubscribe, body: unknown) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]) as unknown as import("node:http").IncomingMessage;
  (req as unknown as { headers: object; socket: object }).headers = { "fly-client-ip": `10.0.0.${ip++}` };
  (req as unknown as { socket: object }).socket = {};
  let status = 0;
  const res = { writeHead: (s: number) => (status = s), end: () => {} } as unknown as import("node:http").ServerResponse;
  await fn(req, res);
  return status;
}
const tick = () => new Promise((r) => setTimeout(r, 10));
const sub = (n: number) => ({ endpoint: `https://web.push.apple.com/QGx${n}abcdef`, keys: { p256dh: "BPk" + "x".repeat(80), auth: "a".repeat(22) } });
const CARD = "maxcard222";
const MAX = "max-seat-00001", EZGI = "ezgi-seat-0001", SAM = "sam-seat-00001";
const EN = "{name} is waiting for you. Tap to join.", TR = "{name} seni bekliyor. Katılmak için dokun.";

// Max owns his card; Ezgi and Sam have each called it before (the server saw their seats).
noteSeat(CARD, MAX);
noteSeat(CARD, EZGI);
noteSeat(CARD, SAM);
assert.equal(await call(pushSubscribe, { subscription: sub(1), rooms: { [CARD]: { seat: MAX, own: true } }, text: EN }), 200);
assert.equal(await call(pushSubscribe, { subscription: sub(2), rooms: { [CARD]: { seat: EZGI, own: false } }, text: TR }), 200);
assert.equal(await call(pushSubscribe, { subscription: sub(3), rooms: { [CARD]: { seat: SAM, own: false } }, text: EN }), 200);
assert.equal(await call(pushSubscribe, { subscription: { endpoint: "https://attacker.example/x", keys: sub(9).keys }, rooms: {} }), 400, "only real push services");
console.log("✓ subscriptions accepted only for real push services");

// Someone else can't take over Max's card.
assert.equal(await call(pushSubscribe, { subscription: sub(4), rooms: { [CARD]: { seat: "thief-seat-001", own: true } }, text: EN }), 200);

// Ezgi opens Max's card: only Max is told, in his language. Not Sam, not the would-be thief.
notifyWaiting(CARD, "Ezgi", EZGI, new Set([EZGI]));
await tick();
assert.deepEqual(sent, [{ endpoint: sub(1).endpoint, body: "Ezgi is waiting for you. Tap to join." }]);
console.log("✓ someone opens Max's card: only Max is told (not his other contacts)");

notifyWaiting(CARD, "Ezgi", EZGI, new Set([EZGI]));
await tick();
assert.equal(sent.length, 1);
console.log("✓ no repeat notifications within a few minutes");

// Max opens his own card: the people who've called it are told (Ezgi in Turkish).
sent.length = 0;
notifyWaiting(CARD, "Max", MAX, new Set([MAX]));
await tick();
assert.deepEqual(sent.map((s) => s.body).sort(), ["Max is waiting for you. Tap to join.", "Max seni bekliyor. Katılmak için dokun."]);
assert.ok(!sent.some((s) => s.endpoint === sub(4).endpoint), "a fake owner claim isn't the owner");
console.log("✓ Max opens his card: people who've called it are told, each in their language");

sent.length = 0;
notifyWaiting("othercard1", "Sam", SAM, new Set([SAM]));
await tick();
assert.equal(sent.length, 0);
console.log("✓ cards nobody follows notify nobody");

// A private room of two (nobody owns it): when one opens it, the other is told.
sent.length = 0;
const PAIR = "pairroom77", MAX_P = "max-pair-seat1", EZGI_P = "ezgi-pair-seat";
assert.equal(await call(pushSubscribe, { subscription: sub(5), rooms: { [PAIR]: { seat: EZGI_P, own: false } }, text: TR }), 200);
assert.equal(await call(pushSubscribe, { subscription: sub(6), rooms: { [PAIR]: { seat: MAX_P, own: false } }, text: EN }), 200);
notifyWaiting(PAIR, "Max", MAX_P, new Set([MAX_P]));
await tick();
assert.deepEqual(sent, [{ endpoint: sub(5).endpoint, body: "Max seni bekliyor. Katılmak için dokun." }]);
console.log("✓ private room of two: Max opens it, Ezgi is told (and not Max)");

await call(pushUnsubscribe, { endpoint: sub(1).endpoint });
notifyWaiting(CARD, "Someone", "x-seat-000001", new Set(["x-seat-000001"]));
await tick();
assert.ok(!sent.some((s) => s.endpoint === sub(1).endpoint));
console.log("✓ switching it off stops notifications");

console.log("\nPUSH TESTS PASSED");
process.exit(0);
