"use client";
/**
 * Moving to a new phone, or to a new Home Screen icon on the same phone (each icon has its own
 * storage on iPhone). Everything Simpatico keeps on this phone lives under "talk.*" keys:
 * profile and saved words, photo, call card, Recent with the private rooms you share with
 * people, your phone's private key and seat ids, and settings. "Copy everything" packs them
 * into one code; "Paste my data" on the other one unpacks it. Nothing goes through our server.
 */
const PREFIX = "SIMPATICO1:";
/** Per-install things that shouldn't be copied: the camera explainer and the Home Screen tip. */
const SKIP = new Set(["talk.mediaOk", "talk.a2hs"]);
const MAX_CHARS = 4_000_000;

export type MoveData = Record<string, string>;
export type MoveSummary = { name: string; people: number; words: number; photo: boolean; card: boolean };

function toB64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64(s: string): string {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function exportAll(): string {
  const data: MoveData = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("talk.") || SKIP.has(k)) continue;
      const v = localStorage.getItem(k);
      if (v !== null) data[k] = v;
    }
  } catch {}
  return PREFIX + toB64(JSON.stringify({ v: 1, at: Date.now(), data }));
}

/** Find and check a moving code in pasted text (it may arrive inside a message). */
export function parseMove(text: string): MoveData | null {
  const m = text.match(/SIMPATICO1:([\w-]+)/);
  if (!m || m[1].length > MAX_CHARS) return null;
  try {
    const box = JSON.parse(fromB64(m[1])) as { v?: unknown; data?: unknown };
    if (box.v !== 1 || !box.data || typeof box.data !== "object") return null;
    const out: MoveData = {};
    for (const [k, v] of Object.entries(box.data as Record<string, unknown>)) {
      if (/^talk\.[\w.-]{1,80}$/.test(k) && typeof v === "string" && !SKIP.has(k)) out[k] = v;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

export function summarise(d: MoveData): MoveSummary {
  const json = <T,>(k: string, fallback: T): T => {
    try {
      return d[k] ? (JSON.parse(d[k]) as T) : fallback;
    } catch {
      return fallback;
    }
  };
  const profile = json<{ name?: string; words?: unknown[] }>("talk.profile.v1", {});
  const recent = json<unknown[]>("talk.recent.v1", []);
  return {
    name: (profile.name || d["talk.name"] || "").trim(),
    people: Array.isArray(recent) ? recent.length : 0,
    words: Array.isArray(profile.words) ? profile.words.length : 0,
    photo: !!d["talk.photo"],
    card: !!d["talk.mylink"],
  };
}

/** Replace this install's Simpatico data with the moved data. */
export function applyMove(d: MoveData) {
  const keep = new Set(["talk.mediaOk", "talk.a2hs"]);
  const old: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("talk.") && !keep.has(k)) old.push(k);
  }
  for (const k of old) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v);
}
