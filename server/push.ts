import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import webpush from "web-push";
import { log } from "./log";
import { dataFile } from "./store";

/**
 * "Tell me when someone's waiting": Web Push for call cards (personal links) only.
 *
 * Each phone that allows notifications registers its push address with the call cards it
 * follows (its own, plus any it has joined), and its own seat id in each of those rooms so it
 * isn't told about itself. When someone opens a call card, every phone following it that isn't
 * already in the room gets "{name} is waiting for you". Stored: the push address, the room
 * codes, the seat ids and the notification wording in that phone's language. No names, photos
 * or anything about calls. Payloads are encrypted end to end to the phone (Web Push).
 */

type Sub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  /** room code -> this phone's seat id in that room */
  rooms: Record<string, string>;
  /** "{name} is waiting for you. Tap to join." in the phone's language. */
  text: string;
  at: number;
};

const FILE = () => dataFile("push.json");
const MAX_ROOMS = 50;
const MAX_SUBS = 20_000;
/** Don't tell the same phone about the same room more often than this. */
const QUIET_MS = 3 * 60 * 1000;

let subs: Map<string, Sub> | null = null;
const lastSent = new Map<string, number>();

function load(): Map<string, Sub> {
  if (subs) return subs;
  subs = new Map();
  try {
    if (existsSync(FILE())) for (const s of JSON.parse(readFileSync(FILE(), "utf8")) as Sub[]) subs.set(s.endpoint, s);
  } catch (err) {
    log("push_load_failed", { error: String(err) });
  }
  return subs;
}

function persist() {
  try {
    mkdirSync(dirname(FILE()), { recursive: true });
    writeFileSync(FILE() + ".tmp", JSON.stringify([...load().values()]));
    renameSync(FILE() + ".tmp", FILE());
  } catch (err) {
    log("push_save_failed", { error: String(err) });
  }
}

export function pushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let vapidSet = false;
function vapid() {
  if (!vapidSet && pushConfigured()) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:privacy@simpatico.app", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    vapidSet = true;
  }
}

const ROOM = /^[a-z0-9]{10}$/;
const SEAT = /^[\w-]{8,64}$/;

function readBody(req: IncomingMessage, limit = 16_384): Promise<unknown> {
  return new Promise((resolve) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limit) req.destroy();
      else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

/** GET /api/push/key */
export function pushKey(res: ServerResponse) {
  return json(res, pushConfigured() ? 200 : 404, pushConfigured() ? { key: process.env.VAPID_PUBLIC_KEY } : { error: "off" });
}

/** POST /api/push/subscribe { subscription, rooms: {code: seatId}, text } — adds rooms to this phone's list. */
export async function pushSubscribe(req: IncomingMessage, res: ServerResponse) {
  if (!pushConfigured()) return json(res, 404, { error: "off" });
  const b = (await readBody(req)) as { subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }; rooms?: Record<string, unknown>; text?: unknown } | null;
  const s = b?.subscription;
  const endpoint = typeof s?.endpoint === "string" && /^https:\/\/[^\s]{10,800}$/.test(s.endpoint) ? s.endpoint : null;
  const p256dh = typeof s?.keys?.p256dh === "string" && s.keys.p256dh.length < 200 ? s.keys.p256dh : null;
  const auth = typeof s?.keys?.auth === "string" && s.keys.auth.length < 100 ? s.keys.auth : null;
  const text = typeof b?.text === "string" && b.text.includes("{name}") && b.text.length < 200 ? b.text : "{name} is waiting for you. Tap to join.";
  if (!endpoint || !p256dh || !auth) return json(res, 400, { error: "bad-request" });
  const all = load();
  if (!all.has(endpoint) && all.size >= MAX_SUBS) return json(res, 503, { error: "busy" });
  const sub: Sub = all.get(endpoint) ?? { endpoint, keys: { p256dh, auth }, rooms: {}, text, at: Date.now() };
  sub.keys = { p256dh, auth };
  sub.text = text;
  sub.at = Date.now();
  for (const [code, seat] of Object.entries(b?.rooms ?? {})) {
    if (ROOM.test(code) && typeof seat === "string" && SEAT.test(seat)) {
      delete sub.rooms[code];
      sub.rooms[code] = seat;
    }
  }
  const codes = Object.keys(sub.rooms);
  for (const old of codes.slice(0, Math.max(0, codes.length - MAX_ROOMS))) delete sub.rooms[old];
  all.set(endpoint, sub);
  persist();
  return json(res, 200, { ok: true, rooms: Object.keys(sub.rooms).length });
}

/** POST /api/push/unsubscribe { endpoint } — forgets this phone completely. */
export async function pushUnsubscribe(req: IncomingMessage, res: ServerResponse) {
  const b = (await readBody(req)) as { endpoint?: unknown } | null;
  if (typeof b?.endpoint === "string" && load().delete(b.endpoint)) persist();
  return json(res, 200, { ok: true });
}

/**
 * Someone just opened call card `code`. Tell every phone following it that isn't in the room.
 * `present` = seat ids of everyone in the room now (the newcomer included).
 */
export function notifyWaiting(code: string, name: string, present: Set<string>) {
  if (!pushConfigured() || !ROOM.test(code)) return;
  vapid();
  const now = Date.now();
  for (const sub of load().values()) {
    const seat = sub.rooms[code];
    if (!seat || present.has(seat)) continue;
    const key = `${sub.endpoint}|${code}`;
    if (now - (lastSent.get(key) ?? 0) < QUIET_MS) continue;
    lastSent.set(key, now);
    const body = sub.text.replace(/\{name\}/g, name);
    webpush
      .sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify({ title: "Simpatico", body, url: `/r/${code}`, tag: `wait-${code}` }), { TTL: 120, urgency: "high" })
      .then(() => log("push_sent", { room: code }))
      .catch((err: { statusCode?: number }) => {
        // Gone: the phone unsubscribed, the app was removed or permission was revoked.
        if (err.statusCode === 404 || err.statusCode === 410) {
          load().delete(sub.endpoint);
          persist();
        }
        log("push_failed", { room: code, status: err.statusCode ?? String(err) });
      });
  }
  if (lastSent.size > 50_000) for (const [k, t] of lastSent) if (now - t > QUIET_MS) lastSent.delete(k);
}
