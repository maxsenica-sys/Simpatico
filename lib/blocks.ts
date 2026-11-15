"use client";
/**
 * Blocking, on this phone: who's blocked, and which room bans to lift if you unblock. The
 * server keeps the bans themselves (server/blocks.ts); this phone also hides blocked people
 * from Recent, Active now and Waiting now.
 */
import { peerIdFor } from "./prefs";
import { forgetRecent, loadRecent, samePerson } from "./recent";

const KEY = "talk.blocked.v1";
export type Ban = { room: string; seat: string };
export type Blocked = { name: string; at: number; bans: Ban[]; pair?: string };

export function loadBlocked(): Blocked[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Blocked[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function save(list: Blocked[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-200)));
  } catch {}
}

export function isBlockedName(name: string): boolean {
  return loadBlocked().some((b) => samePerson(b.name, name));
}

const post = (path: string, body: unknown) =>
  fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);

/**
 * Block someone. `room` + `seat`: the room we're in with them and their seat there (in a call).
 * Their private room with me (from Recent) is closed to everyone but me.
 */
export async function blockPerson(p: { name: string; room?: string; seat?: string }) {
  const bans: Ban[] = [];
  if (p.room && p.seat && /^[a-z0-9]{10}$/.test(p.room)) bans.push({ room: p.room, seat: p.seat });
  const pair = loadRecent().find((r) => samePerson(r.name, p.name))?.pair;
  if (pair && pair !== p.room) bans.push({ room: pair, seat: "*" });
  await Promise.all(bans.map((b) => post("/api/block", { room: b.room, by: peerIdFor(b.room), seat: b.seat })));
  forgetRecent(p.name);
  save([...loadBlocked().filter((b) => !samePerson(b.name, p.name)), { name: p.name, at: Date.now(), bans, pair }]);
}

export async function unblockPerson(name: string) {
  const b = loadBlocked().find((x) => samePerson(x.name, name));
  if (b) await Promise.all(b.bans.map((ban) => post("/api/block", { room: ban.room, by: peerIdFor(ban.room), seat: ban.seat, unblock: true })));
  save(loadBlocked().filter((x) => !samePerson(x.name, name)));
}

export async function reportPerson(p: { name: string; reason: string; note: string; room?: string; seat?: string; block: boolean }) {
  await post("/api/report-person", {
    reason: p.reason,
    note: p.note || undefined,
    name: p.name,
    room: p.room,
    seat: p.seat,
    by: p.room ? peerIdFor(p.room) : undefined,
    block: p.block,
  });
  if (p.block) await blockPerson(p);
}
