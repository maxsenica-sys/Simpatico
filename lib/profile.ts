"use client";
import type { Gender, SpeakerProfile, Topic } from "@/shared/protocol";
import { baseLang, type ParticipantLang } from "@/shared/lang";

/**
 * "Me": who you are, kept only on this phone (no account). It fills the join screen and is
 * sent with each call so speech recognition spells your words right and the translator
 * understands your slang and region. The server holds it in memory for the call only.
 */
export type Profile = {
  name: string;
  /** "x" = prefer not to say. */
  gender: Gender | "x" | null;
  /** Country you're from (ISO 3166 code, e.g. "AU"): your accent and slang, not where you are now. */
  from: string | null;
  /** Names and words you use: family, pets, teams, places, nicknames. */
  words: string[];
  topics: Topic[];
};

const NAME_KEY = "talk.name";
const GENDER_KEY = "talk.gender";
const KEY = "talk.profile.v1";
export const MAX_WORDS = 30;

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function set(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

export function loadProfile(): Profile {
  const g = get(GENDER_KEY);
  let rest: Partial<Profile> = {};
  try {
    rest = JSON.parse(get(KEY) ?? "{}") as Partial<Profile>;
  } catch {}
  return {
    name: get(NAME_KEY) ?? "",
    gender: g === "m" || g === "f" || g === "x" ? g : null,
    from: typeof rest.from === "string" && /^[A-Z]{2}$/.test(rest.from) ? rest.from : null,
    words: Array.isArray(rest.words) ? rest.words.filter((w) => typeof w === "string").slice(0, MAX_WORDS) : [],
    topics: Array.isArray(rest.topics) ? (rest.topics.filter((t) => TOPICS.includes(t as Topic)) as Topic[]) : [],
  };
}

export function saveProfile(p: Profile) {
  set(NAME_KEY, p.name.trim() || null);
  set(GENDER_KEY, p.gender);
  set(KEY, JSON.stringify({ from: p.from, words: p.words, topics: p.topics }));
}

export function clearProfile() {
  for (const k of [NAME_KEY, GENDER_KEY, KEY, "talk.captions.v1", "talk.selfCorner"]) set(k, null);
}

/** What goes to the server with a call (no name or gender: those are sent separately). */
export function speakerProfile(p: Profile): SpeakerProfile {
  return { from: p.from ?? undefined, words: p.words.length ? p.words : undefined, topics: p.topics.length ? p.topics : undefined };
}

/** Your language with your region: English + from Australia = "en-AU" (slang and accent). */
export function callLang(lang: ParticipantLang, p: Profile): ParticipantLang {
  if (!p.from) return lang;
  const withRegion = (code: string) => `${baseLang(code) ?? code}-${p.from}`;
  return { ...lang, speaks: withRegion(lang.speaks) };
}

export const TOPICS: Topic[] = ["sport", "family", "work", "school", "travel", "food", "gaming", "music", "health", "faith"];

/** Every country, named in the UI language, sorted. */
export function countries(ui: string): { code: string; name: string }[] {
  const codes: string[] = [];
  for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) codes.push(String.fromCharCode(a, b));
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([ui], { type: "region", fallback: "none" });
  } catch {}
  return codes
    .map((code) => ({ code, name: names?.of(code) ?? "" }))
    .filter((c) => c.name && c.name !== c.code && !/^(EU|EZ|UN|QO|XA|XB|ZZ)$/.test(c.code))
    .sort((x, y) => x.name.localeCompare(y.name, ui));
}

/**
 * Moving to another phone without an account: the whole profile travels inside a link's
 * #fragment, which browsers never send to a server. Open (or scan) it on the other phone.
 * The groundwork for accounts later (docs/accounts.md): the same Transfer shape will be what
 * a signed-in phone syncs.
 */
export type Transfer = { v: 1; profile: Profile; captions?: unknown; speaks?: string };

function toBase64Url(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(s: string): string {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function transferLink(origin: string, t: Omit<Transfer, "v">): string {
  return `${origin}/profile#import=${toBase64Url(JSON.stringify({ v: 1, ...t }))}`;
}

export function readTransfer(hash: string): Transfer | null {
  const m = hash.match(/^#import=([\w-]+)$/);
  if (!m) return null;
  try {
    const t = JSON.parse(fromBase64Url(m[1])) as Transfer;
    if (t.v !== 1 || typeof t.profile !== "object") return null;
    return t;
  } catch {
    return null;
  }
}
