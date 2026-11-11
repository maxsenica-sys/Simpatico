/**
 * "Recent": the people you've called, kept on this phone only (like the profile). Nothing about
 * who you call is sent to or stored on the server. One entry per person, matched by name.
 */
const KEY = "talk.recent.v1";
const KEEP = 20;

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
export function noteCall(name: string, lang: string) {
  if (!name.trim()) return;
  const list = loadRecent();
  const hit = list.find((r) => norm(r.name) === norm(name));
  if (hit) {
    hit.at = Date.now();
    hit.calls += 1;
    hit.lang = lang;
    hit.name = name.trim();
  } else list.push({ name: name.trim(), lang, at: Date.now(), calls: 1, seconds: 0 });
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

export function forgetRecent(name: string) {
  save(loadRecent().filter((r) => norm(r.name) !== norm(name)));
}

export function clearRecent() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
