/**
 * Conversations kept on this phone, for people who turn that on (Me page). Nothing here goes to
 * our servers: the words stay in the browser's own storage on this device, and "Clear my profile"
 * or the delete buttons remove them. Text only, so even hundreds of long conversations are small.
 */
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
};

const KEEP = "talk.keep";
const DB = "simpatico";
const STORE = "talks";
/** The most conversations kept; the oldest go first. */
const MAX_TALKS = 200;

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
function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const tx = db.transaction(STORE, mode);
          const req = fn(tx.objectStore(STORE));
          let out: T | undefined;
          if (req) req.onsuccess = () => (out = req.result);
          tx.oncomplete = () => {
            db.close();
            resolve(out);
          };
          tx.onerror = tx.onabort = () => {
            db.close();
            resolve(undefined);
          };
        } catch {
          db.close();
          resolve(undefined);
        }
      }),
  );
}

/** Add or update a conversation (safe to call often while it is still going). Empty ones are not kept. */
export async function saveTalk(talk: SavedTalk): Promise<void> {
  const lines = talk.lines.filter((l) => (l.said ?? "").trim() || (l.read ?? "").trim());
  if (!lines.length) return;
  await run("readwrite", (s) => s.put({ ...talk, lines }));
  const all = await listTalks();
  for (const old of all.slice(MAX_TALKS)) await deleteTalk(old.id);
}
/** Newest first. */
export async function listTalks(): Promise<SavedTalk[]> {
  const all = (await run<SavedTalk[]>("readonly", (s) => s.getAll())) ?? [];
  return all.sort((a, b) => b.startedAt - a.startedAt);
}
export async function deleteTalk(id: string): Promise<void> {
  await run("readwrite", (s) => s.delete(id));
}
export async function clearTalks(): Promise<void> {
  await run("readwrite", (s) => s.clear());
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
