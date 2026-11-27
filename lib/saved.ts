/**
 * Conversations on this phone. Nothing here goes to our servers: the words stay in the browser's
 * own storage on this device.
 *
 * Two kinds:
 *  - Kept: for people who turn "Keep my conversations on this phone" on. Stay until deleted.
 *  - Recovery copies: every conversation is written here line by line while it runs, whatever
 *    the setting, so a dead battery, a crash or a closed app cannot lose it. A recovery copy that
 *    nobody chose to keep is deleted by itself after RECOVERY_DAYS.
 *
 * Belt and braces, because this is the only copy that exists:
 *  - written the moment a line is finished (not on a timer), with the storage told to write it
 *    through to disk;
 *  - a second store (localStorage) takes over when the main one (IndexedDB) fails;
 *  - the phone is asked to treat this storage as permanent;
 *  - in the iPhone app, each kept conversation is also written as a text file (see lib/native.ts).
 */
import { removeTalkFile, writeTalkFile } from "./native";

export type SavedLine = {
  who: "me" | "them";
  /** Their name, in calls. */
  name?: string;
  /** As it was said, in the speaker's language. */
  said?: string;
  /** Its translation, as the other person read it. */
  read?: string;
  at: number;
};
export type SavedTalk = {
  id: string;
  kind: "pair" | "group" | "inperson";
  startedAt: number;
  endedAt: number;
  /** Who it was with (calls). */
  with: string[];
  /** The languages, mine first. */
  langs: string[];
  lines: SavedLine[];
  /** A recovery copy nobody has chosen to keep yet: deleted by itself after `expires`. */
  draft?: boolean;
  expires?: number;
  /** Still running, or ended without the person getting the chance to choose (crash, battery, app closed). */
  open?: boolean;
};

const KEEP = "talk.keep";
const FALLBACK = "talk.saved.fallback";
const DB = "simpatico";
const STORE = "talks";
/** The most conversations kept; the oldest go first. */
const MAX_TALKS = 200;
/** How long a recovery copy nobody kept stays on the phone. */
export const RECOVERY_DAYS = 3;
/** The second store is small: only the newest few conversations fit. */
const FALLBACK_MAX_CHARS = 1_500_000;

export function keepsTalks(): boolean {
  try {
    return localStorage.getItem(KEEP) === "1";
  } catch {
    return false;
  }
}
export function setKeepTalks(on: boolean) {
  try {
    if (on) localStorage.setItem(KEEP, "1");
    else localStorage.removeItem(KEEP);
  } catch {}
  if (on) askPermanent();
}

/** Ask the phone not to clear this storage when it is short of space. Harmless where unsupported. */
let asked = false;
function askPermanent() {
  if (asked) return;
  asked = true;
  try {
    void navigator.storage?.persist?.().catch(() => {});
  } catch {}
}

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
/** One read or write. `ok` false: the main store is unavailable or refused. */
function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<{ ok: boolean; value?: T }> {
  return open().then(
    (db) =>
      new Promise<{ ok: boolean; value?: T }>((resolve) => {
        if (!db) return resolve({ ok: false });
        try {
          let tx: IDBTransaction;
          try {
            // "strict": on disk before it reports done, so a battery dying a moment later loses nothing.
            tx = db.transaction(STORE, mode, mode === "readwrite" ? { durability: "strict" } : undefined);
          } catch {
            tx = db.transaction(STORE, mode);
          }
          const req = fn(tx.objectStore(STORE));
          let out: T | undefined;
          if (req) req.onsuccess = () => (out = req.result);
          tx.oncomplete = () => {
            db.close();
            resolve({ ok: true, value: out });
          };
          tx.onerror = tx.onabort = () => {
            db.close();
            resolve({ ok: false });
          };
        } catch {
          db.close();
          resolve({ ok: false });
        }
      }),
  );
}

// ---- the second store
function fallbackRead(): Record<string, SavedTalk> {
  try {
    const v = JSON.parse(localStorage.getItem(FALLBACK) ?? "{}");
    return v && typeof v === "object" ? (v as Record<string, SavedTalk>) : {};
  } catch {
    return {};
  }
}
function fallbackWrite(all: Record<string, SavedTalk>): boolean {
  // Newest first until it fits.
  const ids = Object.keys(all).sort((a, b) => all[b].startedAt - all[a].startedAt);
  for (let n = ids.length; n > 0; n--) {
    const text = JSON.stringify(Object.fromEntries(ids.slice(0, n).map((id) => [id, all[id]])));
    if (text.length > FALLBACK_MAX_CHARS && n > 1) continue;
    try {
      localStorage.setItem(FALLBACK, text);
      return true;
    } catch {}
  }
  try {
    if (!ids.length) localStorage.removeItem(FALLBACK);
  } catch {}
  return !ids.length;
}

const fileAt = new Map<string, number>();
const clean = (talk: SavedTalk): SavedTalk => ({ ...talk, lines: talk.lines.filter((l) => (l.said ?? "").trim() || (l.read ?? "").trim()) });

/**
 * Add or update a conversation (safe to call on every line). Empty ones are not kept.
 * False: this phone could not store it anywhere (tell the person to save it as a file).
 */
export async function saveTalk(talk: SavedTalk): Promise<boolean> {
  const t = clean(talk);
  if (!t.lines.length) return true;
  askPermanent();
  const main = await run("readwrite", (s) => s.put(t));
  let ok = main.ok;
  if (ok) {
    // It reached the main store: a copy left in the second one from a bad moment is no longer needed.
    const fb = fallbackRead();
    if (fb[t.id]) {
      delete fb[t.id];
      fallbackWrite(fb);
    }
  } else {
    const fb = fallbackRead();
    fb[t.id] = t;
    ok = fallbackWrite(fb) && !!fallbackRead()[t.id];
  }
  // Kept conversations: also a readable file in the iPhone app's own folder (Files app, phone backups).
  // While it is still running, the file is refreshed every 20 seconds; once more when it ends.
  if (ok && !t.draft && (!t.open || Date.now() - (fileAt.get(t.id) ?? 0) > 20_000)) {
    fileAt.set(t.id, Date.now());
    void writeTalkFile(t);
  }
  return ok;
}

/** The conversation as it runs: kept if they asked for that, otherwise a recovery copy. */
export function stashTalk(talk: SavedTalk, open: boolean): Promise<boolean> {
  return saveTalk(keepsTalks() ? { ...talk, open: open || undefined, draft: undefined, expires: undefined } : { ...talk, open: open || undefined, draft: true, expires: Date.now() + RECOVERY_DAYS * 86_400_000 });
}
/** Turn a recovery copy into a kept conversation. */
export async function keepTalk(id: string): Promise<boolean> {
  const t = (await everything()).find((x) => x.id === id);
  if (!t) return false;
  return saveTalk({ ...t, draft: undefined, expires: undefined, open: undefined });
}

async function everything(): Promise<SavedTalk[]> {
  const main = (await run<SavedTalk[]>("readonly", (s) => s.getAll())).value ?? [];
  const fb = fallbackRead();
  const byId = new Map<string, SavedTalk>();
  for (const t of [...Object.values(fb), ...main]) {
    const had = byId.get(t.id);
    // Whichever copy has more of the conversation.
    if (!had || t.lines.length >= had.lines.length) byId.set(t.id, t);
  }
  const now = Date.now();
  const live: SavedTalk[] = [];
  for (const t of byId.values()) {
    if (t.draft && (t.expires ?? 0) < now) void deleteTalk(t.id);
    else live.push(t);
  }
  return live.sort((a, b) => b.startedAt - a.startedAt);
}
/** Kept conversations, newest first. */
export async function listTalks(): Promise<SavedTalk[]> {
  const kept = (await everything()).filter((t) => !t.draft);
  for (const old of kept.slice(MAX_TALKS)) void deleteTalk(old.id);
  return kept.slice(0, MAX_TALKS);
}
/** Recovery copies not yet kept or deleted, newest first. */
export async function listDrafts(): Promise<SavedTalk[]> {
  return (await everything()).filter((t) => t.draft);
}
/** One conversation, kept or recovery copy (for carrying on after a reload). */
export async function getTalk(id: string): Promise<SavedTalk | null> {
  return (await everything()).find((t) => t.id === id) ?? null;
}
export async function deleteTalk(id: string): Promise<void> {
  const all = await run<SavedTalk[]>("readonly", (s) => s.getAll());
  const t = all.value?.find((x) => x.id === id);
  await run("readwrite", (s) => s.delete(id));
  const fb = fallbackRead();
  if (fb[id]) {
    delete fb[id];
    fallbackWrite(fb);
  }
  if (t && !t.draft) void removeTalkFile(t);
}
/** Everything: kept conversations and recovery copies. */
export async function clearTalks(): Promise<void> {
  for (const t of await everything()) if (!t.draft) void removeTalkFile(t);
  await run("readwrite", (s) => s.clear());
  try {
    localStorage.removeItem(FALLBACK);
  } catch {}
}

/**
 * A call that reloads (the phone reclaimed memory, a pull to refresh, the app reopened) rejoins the
 * same room: its lines must carry on in the same saved conversation, not start a second one. The
 * same room within 15 minutes is the same conversation.
 */
const CALL_ID = "talk.callid";
export function callTalkId(room: string): string {
  const now = Date.now();
  try {
    const v = JSON.parse(localStorage.getItem(CALL_ID) ?? "null") as { room: string; id: string; at: number } | null;
    const id = v && v.room === room && now - v.at < 15 * 60_000 ? v.id : `call-${room}-${now}`;
    localStorage.setItem(CALL_ID, JSON.stringify({ room, id, at: now }));
    return id;
  } catch {
    return `call-${room}-${now}`;
  }
}
/** The conversation is still going: keep its id alive for a reload. */
export function touchCallTalk(room: string, id: string) {
  try {
    localStorage.setItem(CALL_ID, JSON.stringify({ room, id, at: Date.now() }));
  } catch {}
}

/** Lines from before a reload joined to the lines since, in time order, nothing twice. */
export function mergeLines(before: SavedLine[], since: SavedLine[]): SavedLine[] {
  const byKey = new Map<string, SavedLine>();
  for (const l of [...before, ...since]) byKey.set(`${l.at}-${l.who}`, l);
  return [...byKey.values()].sort((a, b) => a.at - b.at);
}

/** The whole conversation as text, both languages on every line where we have them. */
export function talkText(talk: SavedTalk, labels: { you: string; them: string; title: string }): string {
  const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const head = `${labels.title} · ${new Date(talk.startedAt).toLocaleString()}${talk.with.length ? ` · ${talk.with.join(", ")}` : ""}`;
  const body = talk.lines
    .map((l) => {
      const who = l.who === "me" ? labels.you : l.name || labels.them;
      const first = (l.said ?? "").trim() || (l.read ?? "").trim();
      const second = (l.said ?? "").trim() && (l.read ?? "").trim() ? `\n    → ${l.read!.trim()}` : "";
      return `[${time(l.at)}] ${who}: ${first}${second}`;
    })
    .join("\n");
  return `${head}\n\n${body}\n`;
}
