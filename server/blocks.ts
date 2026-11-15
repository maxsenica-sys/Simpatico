import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { log } from "./log";
import { isCard, readBody, wasSeated } from "./push";
import { append, dataFile } from "./store";

/**
 * Report and block. A block shuts one phone (its random seat id in that room) out of a call card
 * or a private room of two. Only someone who has really been in that room can block in it.
 * A report keeps the reason, note, time and the name they used: calls aren't recorded, so there
 * is nothing else to keep. Stored on the server's disk: /data/blocks.json, /data/abuse.jsonl.
 */
const FILE = () => dataFile("blocks.json");
const ROOM = /^[a-z0-9]{10}$/;
const SEAT = /^[\w-]{8,64}$/;
let bans: Map<string, Set<string>> | null = null;

function load(): Map<string, Set<string>> {
  if (bans) return bans;
  bans = new Map();
  try {
    if (existsSync(FILE())) for (const [room, seats] of Object.entries(JSON.parse(readFileSync(FILE(), "utf8")) as Record<string, string[]>)) bans.set(room, new Set(seats));
  } catch (err) {
    log("blocks_load_failed", { error: String(err) });
  }
  return bans;
}

let timer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (timer) return;
  timer = setTimeout(async () => {
    timer = null;
    try {
      mkdirSync(dirname(FILE()), { recursive: true });
      await writeFile(FILE() + ".tmp", JSON.stringify(Object.fromEntries([...load()].map(([r, s]) => [r, [...s]]))));
      await rename(FILE() + ".tmp", FILE());
    } catch (err) {
      log("blocks_save_failed", { error: String(err) });
    }
  }, 1000);
}

export function isBlocked(room: string, seat: string): boolean {
  const set = load().get(room);
  if (!set) return false;
  if (set.has(seat)) return true;
  // "*:<seat>" = a private room of two closed to everyone except that seat.
  return [...set].some((s) => s.startsWith("*:") && s.slice(2) !== seat);
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function setBlock(room: string, by: string, seat: string, on: boolean): boolean {
  // seat "*" = everyone else (used for a private room of two, where only the two ever sit).
  const everyone = seat === "*";
  if (!ROOM.test(room) || !SEAT.test(by)) return false;
  if (everyone) {
    // Only a private room of two can be closed, and its code is known only to those two phones.
    // A call card can't be closed this way.
    if (isCard(room)) return false;
  } else if (!SEAT.test(seat) || by === seat || !wasSeated(room, by)) return false;
  if (everyone) seat = `*:${by}`;
  const all = load();
  const set = all.get(room) ?? new Set<string>();
  if (on) set.add(seat);
  else set.delete(seat);
  if (set.size) all.set(room, set);
  else all.delete(room);
  persist();
  return true;
}

/** POST /api/block {room, by, seat, unblock?} */
export async function blockRoute(req: IncomingMessage, res: ServerResponse) {
  const b = (await readBody(req, 4096)) as { room?: unknown; by?: unknown; seat?: unknown; unblock?: unknown } | null;
  const ok = typeof b?.room === "string" && typeof b.by === "string" && typeof b.seat === "string" && setBlock(b.room, b.by, b.seat, b.unblock !== true);
  return json(res, ok ? 200 : 400, { ok });
}

const REASONS = new Set(["harassment", "inappropriate", "spam", "other"]);
const recentReports = new Map<string, number[]>();

/** POST /api/report-person {reason, note?, name?, room?, by?, seat?, block?} */
export async function reportRoute(req: IncomingMessage, res: ServerResponse) {
  const b = (await readBody(req, 8192)) as Record<string, unknown> | null;
  const reason = typeof b?.reason === "string" && REASONS.has(b.reason) ? b.reason : null;
  if (!reason) return json(res, 400, { ok: false });
  const ip = String(req.headers["fly-client-ip"] ?? req.socket.remoteAddress ?? "?");
  const now = Date.now();
  const hits = (recentReports.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (hits.length >= 10) return json(res, 429, { ok: false });
  recentReports.set(ip, [...hits, now]);
  const clean = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, n) : undefined);
  const room = clean(b?.room, 10);
  const seat = clean(b?.seat, 64);
  append("abuse", { reason, note: clean(b?.note, 500), name: clean(b?.name, 40), room, seat });
  log("person_reported", { reason });
  if (b?.block === true && room && seat && typeof b.by === "string") setBlock(room, b.by, seat, true);
  return json(res, 200, { ok: true });
}
