/**
 * "Recent": the people you've called, kept on this phone only (like the profile). Nothing about
 * who you call is sent to or stored on the server. One entry per person, matched by name.
 */
const KEY = "talk.recent.v1";
/** Everyone you have called is a contact; the home screen shows the five most recent. */
const KEEP = 200;

export type RecentPerson = {
  name: string;
  /** The language they speak (a BCP-47 tag), as they joined with it. */
  lang: string;
  /** Last time a call with them connected (ms). */
  at: number;
  calls: number;
  /** Total time in calls together. */
  seconds: number;
  /** Length of the most recent call. */
  last?: number;
  /** Their profile photo as their phone last sent it (updates on every call). */
  photo?: string | null;
  /** The call card room we last talked in, if it was one (for "Waiting now"). */
  room?: string;
  /** Our own private room (see lib/pair.ts): tapping them in Recent goes straight there. */
  pair?: string;
};

const norm = (name: string) => name.trim().toLocaleLowerCase();

export function loadRecent(): RecentPerson[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]") as RecentPerson[];
    return Array.isArray(list) ? list.filter((r) => r && typeof r.name === "string" && r.name.trim()).sort((a, b) => b.at - a.at) : [];
  } catch {
    return [];
  }
}

function save(list: RecentPerson[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.sort((a, b) => b.at - a.at).slice(0, KEEP)));
  } catch {}
}

/** A call with this person just connected. */
/** Names the server gives people who didn't type one ("Guest A"): not a person to remember. */
const DEFAULT_NAME = /^Guest [A-Z0-9]+$/;

export function noteCall(name: string, lang: string, room?: string) {
  if (!name.trim() || DEFAULT_NAME.test(name.trim())) return;
  const card = room && /^[a-z0-9]{10}$/.test(room) ? room : undefined;
  const list = loadRecent();
  const hit = list.find((r) => norm(r.name) === norm(name));
  if (hit) {
    hit.at = Date.now();
    hit.calls += 1;
    hit.lang = lang;
    hit.name = name.trim();
    if (card) hit.room = card;
  } else list.push({ name: name.trim(), lang, at: Date.now(), calls: 1, seconds: 0, room: card });
  save(list);
}

/** Their phone sent its profile photo during the call: keep the newest one. */
export function notePhoto(name: string, photo: string | null) {
  const list = loadRecent();
  const hit = list.find((r) => norm(r.name) === norm(name));
  if (!hit || hit.photo === photo) return;
  hit.photo = photo;
  save(list);
}

/** Their phone and mine worked out our shared room during the call. */
export function notePair(name: string, code: string) {
  if (!/^[a-z0-9]{10}$/.test(code)) return;
  const list = loadRecent();
  const hit = list.find((r) => norm(r.name) === norm(name));
  if (!hit || hit.pair === code) return;
  hit.pair = code;
  save(list);
}

/** The call ended: add its length to everyone who was in it. */
export function noteTime(names: string[], seconds: number) {
  if (!(seconds > 0)) return;
  const want = new Set(names.map(norm));
  const list = loadRecent();
  for (const r of list)
    if (want.has(norm(r.name))) {
      r.seconds += Math.round(seconds);
      r.last = Math.round(seconds);
    }
  save(list);
}

/** Same person? (Recent matches people by name.) */
export function samePerson(a: string, b: string) {
  return norm(a) === norm(b);
}

export function forgetRecent(name: string) {
  save(loadRecent().filter((r) => norm(r.name) !== norm(name)));
}

export function clearRecent() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
