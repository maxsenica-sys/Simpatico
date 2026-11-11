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
const { pushSubscribe, notifyWaiting, pushUnsubscribe } = await import("../server/push");

async function call(fn: typeof pushSubscribe, body: unknown) {
  const req = Readable.from([Buffer.from(JSON.stringify(body))]) as unknown as import("node:http").IncomingMessage;
  let status = 0;
  const res = { writeHead: (s: number) => (status = s), end: () => {} } as unknown as import("node:http").ServerResponse;
  await fn(req, res);
  return status;
}
const sub = (n: number) => ({ endpoint: `https://push.example.com/send/${n}`, keys: { p256dh: "BPk" + "x".repeat(80), auth: "a".repeat(22) } });
const MAX_CARD = "maxcard222", EZGI_SEAT_IN_MAX = "ezgi-seat-0001", MAX_SEAT = "max-seat-00001";

// Max's phone follows his own card; Ezgi's phone follows Max's card (she joined it before).
assert.equal(await call(pushSubscribe, { subscription: sub(1), rooms: { [MAX_CARD]: MAX_SEAT }, text: "{name} is waiting for you. Tap to join." }), 200);
assert.equal(await call(pushSubscribe, { subscription: sub(2), rooms: { [MAX_CARD]: EZGI_SEAT_IN_MAX }, text: "{name} seni bekliyor. Katılmak için dokun." }), 200);
assert.equal(await call(pushSubscribe, { subscription: { endpoint: "http://insecure" }, rooms: {} }), 400, "bad subscriptions are refused");

// Ezgi opens Max's card: only Max's phone is told, in his language.
notifyWaiting(MAX_CARD, "Ezgi", new Set([EZGI_SEAT_IN_MAX]));
await new Promise((r) => setTimeout(r, 10));
assert.deepEqual(sent, [{ endpoint: sub(1).endpoint, body: "Ezgi is waiting for you. Tap to join." }]);
console.log("✓ Ezgi opens Max's card: Max's phone is told, not Ezgi's own");

// Again a minute later: no repeat (quiet period).
notifyWaiting(MAX_CARD, "Ezgi", new Set([EZGI_SEAT_IN_MAX]));
await new Promise((r) => setTimeout(r, 10));
assert.equal(sent.length, 1);
console.log("✓ no repeat notifications within a few minutes");

// Max opens his own card: Ezgi's phone is told, in Turkish.
sent.length = 0;
notifyWaiting(MAX_CARD, "Max", new Set([MAX_SEAT]));
await new Promise((r) => setTimeout(r, 10));
assert.deepEqual(sent, [{ endpoint: sub(2).endpoint, body: "Max seni bekliyor. Katılmak için dokun." }]);
console.log("✓ Max opens his card: Ezgi is told, in her language");

// Someone already in the room isn't told; other rooms tell nobody.
sent.length = 0;
notifyWaiting("othercard1", "Sam", new Set());
await new Promise((r) => setTimeout(r, 10));
assert.equal(sent.length, 0);
console.log("✓ rooms nobody follows notify nobody");

// Turning it off forgets the phone.
await call(pushUnsubscribe, { endpoint: sub(2).endpoint });
notifyWaiting(MAX_CARD, "Someone", new Set(["x-seat-000001"]));
await new Promise((r) => setTimeout(r, 10));
assert.ok(!sent.some((s) => s.endpoint === sub(2).endpoint), "unsubscribed phone not told");
console.log("✓ switching it off stops notifications");

console.log("\nPUSH TESTS PASSED");
process.exit(0);
