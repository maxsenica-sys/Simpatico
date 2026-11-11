import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import webpush from "web-push";
import { log } from "./log";
import { dataFile } from "./store";

/**
 * "Tell me when someone's waiting": Web Push for call cards (personal links) only.
 *
 * Each phone that allows notifications registers its push address with the call cards it
 * follows: its own card (it becomes the card's owner: the first phone to claim a code owns it),
 * and cards it has joined. Who is told:
 *  - someone opens your own card -> you ("Ezgi is waiting for you");
 *  - the owner opens a card you've joined -> you ("Max is waiting for you");
 *  - nobody else: a third person opening Max's card doesn't notify Max's other callers.
 * Stored: push address, card codes, this phone's seat id per card (so it isn't told about
 * itself), the wording in its language, and when it last checked in. No names or call history.
 * Payloads are encrypted end to end to the phone.
 */

type Follow = { seat: string; own: boolean };
type Sub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  rooms: Record<string, Follow>;
  text: string;
  at: number;
};
type Saved = { subs: Sub[]; owners: Record<string, string>; seen?: Record<string, string[]> };

const FILE = () => dataFile("push.json");
const MAX_FOLLOWED = 50;
const MAX_SUBS = 20_000;
/** A phone that hasn't opened the app in this long is forgotten. */
const EXPIRE_MS = 120 * 24 * 60 * 60 * 1000;
/** Don't tell the same phone about the same card more often than this. */
const QUIET_MS = 3 * 60 * 1000;
/** Real push services only (the server POSTs to these addresses). */
const PUSH_HOST = /(^|\.)(fcm\.googleapis\.com|android\.googleapis\.com|push\.apple\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/;

let subs: Map<string, Sub> | null = null;
let owners: Map<string, string> = new Map();
/** Seat ids that have actually been in each call card's room: only they may follow it. */
let seen: Map<string, string[]> = new Map();
const SEEN_PER_CARD = 50;

/** Someone took a seat in call card `code`. */
export function noteSeat(code: string, seat: string) {
  if (!ROOM.test(code) || !SEAT.test(seat)) return;
  load();
  const list = (seen.get(code) ?? []).filter((s) => s !== seat);
  list.push(seat);
  seen.set(code, list.slice(-SEEN_PER_CARD));
  if (seen.size > 100_000) seen.delete(seen.keys().next().value!);
  persist();
}
const lastSent = new Map<string, number>();

function load(): Map<string, Sub> {
  if (subs) return subs;
  subs = new Map();
  try {
    if (existsSync(FILE())) {
      const raw = JSON.parse(readFileSync(FILE(), "utf8")) as Saved | Sub[];
      const list = Array.isArray(raw) ? raw : raw.subs;
      owners = new Map(Object.entries(Array.isArray(raw) ? {} : (raw.owners ?? {})));
      seen = new Map(Object.entries(Array.isArray(raw) ? {} : (raw.seen ?? {})));
      const now = Date.now();
      for (const s of list) {
        if (now - (s.at ?? 0) > EXPIRE_MS) continue;
        // Older entries stored just the seat id.
        for (const [code, f] of Object.entries(s.rooms ?? {})) if (typeof f === "string") s.rooms[code] = { seat: f, own: false };
        subs.set(s.endpoint, s);
      }
    }
  } catch (err) {
    log("push_load_failed", { error: String(err) });
  }
  return subs;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** Written in the background, at most every 2 s, so live calls never wait on the disk. */
function persist() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      mkdirSync(dirname(FILE()), { recursive: true });
      const data: Saved = { subs: [...load().values()], owners: Object.fromEntries(owners), seen: Object.fromEntries(seen) };
      await writeFile(FILE() + ".tmp", JSON.stringify(data));
      await rename(FILE() + ".tmp", FILE());
    } catch (err) {
      log("push_save_failed", { error: String(err) });
    }
  }, 2_000);
}

let vapidState: "unset" | "ok" | "bad" = "unset";
/** Keys present and accepted by web-push. A bad key just turns notifications off. */
export function pushConfigured(): boolean {
  if (vapidState === "unset") {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
    try {
      webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:privacy@simpatico.app", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
      vapidState = "ok";
    } catch (err) {
      vapidState = "bad";
      log("push_keys_invalid", { error: String(err) });
    }
  }
  return vapidState === "ok";
}

const ROOM = /^[a-z0-9]{10}$/;
const SEAT = /^[\w-]{8,64}$/;

export function readBody(req: IncomingMessage, limit = 16_384): Promise<unknown> {
  return new Promise((resolve) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        resolve(null);
        req.destroy();
      } else chunks.push(c);
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

/** At most 20 subscribe calls a minute from one address. */
const hits = new Map<string, number[]>();
function limited(req: IncomingMessage): boolean {
  const ip = String(req.headers["fly-client-ip"] ?? req.socket.remoteAddress ?? "?");
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some((t) => now - t < 60_000)) hits.delete(k);
  return recent.length > 20;
}

/** GET /api/push/key */
export function pushKey(res: ServerResponse) {
  return json(res, pushConfigured() ? 200 : 404, pushConfigured() ? { key: process.env.VAPID_PUBLIC_KEY } : { error: "off" });
}

/** POST /api/push/subscribe { subscription, rooms: {code: {seat, own}}, text } */
export async function pushSubscribe(req: IncomingMessage, res: ServerResponse) {
  if (!pushConfigured()) return json(res, 404, { error: "off" });
  if (limited(req)) return json(res, 429, { error: "slow-down" });
  const b = (await readBody(req)) as { subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }; rooms?: Record<string, unknown>; text?: unknown } | null;
  const s = b?.subscription;
  let endpoint: string | null = null;
  try {
    const u = typeof s?.endpoint === "string" && s.endpoint.length < 1000 ? new URL(s.endpoint) : null;
    if (u && u.protocol === "https:" && PUSH_HOST.test(u.hostname)) endpoint = u.href;
  } catch {}
  const p256dh = typeof s?.keys?.p256dh === "string" && /^[\w-]{40,200}$/.test(s.keys.p256dh) ? s.keys.p256dh : null;
  const auth = typeof s?.keys?.auth === "string" && /^[\w-]{10,100}$/.test(s.keys.auth) ? s.keys.auth : null;
  const text = typeof b?.text === "string" && b.text.includes("{name}") && b.text.length < 200 ? b.text : "{name} is waiting for you. Tap to join.";
  if (!endpoint || !p256dh || !auth) return json(res, 400, { error: "bad-request" });
  const all = load();
  if (!all.has(endpoint) && all.size >= MAX_SUBS) return json(res, 503, { error: "busy" });
  const sub: Sub = all.get(endpoint) ?? { endpoint, keys: { p256dh, auth }, rooms: {}, text, at: Date.now() };
  sub.keys = { p256dh, auth };
  sub.text = text;
  sub.at = Date.now();
  for (const [code, raw] of Object.entries(b?.rooms ?? {})) {
    const f = raw as { seat?: unknown; own?: unknown };
    if (!ROOM.test(code) || typeof f?.seat !== "string" || !SEAT.test(f.seat)) continue;
    let own = f.own === true;
    if (own) {
      // The first phone to claim a card owns it; nobody else can take it over.
      const owner = owners.get(code);
      if (!owner) owners.set(code, f.seat);
      else if (owner !== f.seat) own = false;
    }
    // Following someone else's card: only from a seat that has really been in that room.
    // (Rooms nobody owns are two people's private rooms: their code is known only to them.)
    if (!own && owners.has(code) && !seen.get(code)?.includes(f.seat)) continue;
    delete sub.rooms[code];
    sub.rooms[code] = { seat: f.seat, own };
  }
  // Keep the newest followed cards; your own card is never dropped.
  const followed = Object.entries(sub.rooms).filter(([, f]) => !f.own);
  for (const [code] of followed.slice(0, Math.max(0, followed.length - MAX_FOLLOWED))) delete sub.rooms[code];
  all.set(endpoint, sub);
  persist();
  return json(res, 200, { ok: true });
}

/** POST /api/push/unsubscribe { endpoint } — forgets this phone completely. */
export async function pushUnsubscribe(req: IncomingMessage, res: ServerResponse) {
  const b = (await readBody(req)) as { endpoint?: unknown } | null;
  if (typeof b?.endpoint === "string" && load().delete(b.endpoint)) persist();
  return json(res, 200, { ok: true });
}

/**
 * `joiner` (seat id `joinerSeat`) just opened call card `code`; `present` = seat ids in the
 * room now. Never throws: a notification problem must not affect calls.
 */
export function notifyWaiting(code: string, name: string, joinerSeat: string, present: Set<string>) {
  try {
    if (!pushConfigured() || !ROOM.test(code)) return;
    const owner = owners.get(code);
    const ownerOpened = !!owner && owner === joinerSeat;
    const now = Date.now();
    for (const sub of load().values()) {
      const f = sub.rooms[code];
      if (!f || present.has(f.seat)) continue;
      const isOwner = f.own && owner === f.seat;
      // A call card: its owner is told about anyone; its callers only when the owner opens it.
      // A private room of two (no owner): the other person is told.
      if (owner && !isOwner && !ownerOpened) continue;
      const key = `${sub.endpoint}|${code}`;
      if (now - (lastSent.get(key) ?? 0) < QUIET_MS) continue;
      lastSent.set(key, now);
      const body = sub.text.replace(/\{name\}/g, name);
      webpush
        .sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify({ title: "Simpatico", body, url: `/r/${code}`, tag: `wait-${code}` }), { TTL: 120, urgency: "high" })
        .then(() => log("push_sent", { room: code }))
        .catch((err: { statusCode?: number }) => {
          // Gone: the phone unsubscribed, the app was removed or permission was revoked.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            load().delete(sub.endpoint);
            persist();
          }
          log("push_failed", { room: code, status: err?.statusCode ?? String(err) });
        });
    }
    if (lastSent.size > 50_000) for (const [k, t] of lastSent) if (now - t > QUIET_MS) lastSent.delete(k);
  } catch (err) {
    log("push_notify_failed", { error: String(err) });
  }
}
