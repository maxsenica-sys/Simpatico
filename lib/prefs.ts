"use client";
import { baseLang, isSupported, type ParticipantLang } from "@/shared/lang";

const KEY = "talk.lang.v1";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

/** First supported language from the device's preference list, as a full BCP-47 tag. */
export function detectLang(): ParticipantLang {
  const prefs = [...(navigator.languages ?? []), navigator.language].filter(Boolean);
  const tag = prefs.find((t) => isSupported(t)) ?? "en";
  return { speaks: tag, reads: tag, ui: tag };
}

/** Set once from the device, persisted, never asked again. */
export function loadLang(): ParticipantLang {
  const raw = safeGet(KEY);
  if (raw) {
    try {
      const v = JSON.parse(raw) as ParticipantLang;
      if (isSupported(v.speaks) && isSupported(v.reads)) return { ...v, ui: v.ui || v.reads };
    } catch {}
  }
  const detected = detectLang();
  safeSet(KEY, JSON.stringify(detected));
  return detected;
}

export function saveLang(lang: ParticipantLang) {
  safeSet(KEY, JSON.stringify(lang));
}

/** The single "change" affordance on the join screen sets all three to one language. */
export function langFromChoice(code: string): ParticipantLang {
  return { speaks: code, reads: code, ui: code };
}

/** Stable per-room seat id, so a reload (or reopened tab) rejoins the same seat. */
export function peerIdFor(room: string): string {
  const key = `talk.peer.${room}`;
  let id = safeGet(key);
  if (!id || !/^[\w-]{8,64}$/.test(id)) {
    id = crypto.randomUUID();
    safeSet(key, id);
  }
  return id;
}

export function uiCode(lang: ParticipantLang): string {
  return baseLang(lang.ui) ?? baseLang(lang.reads) ?? "en";
}
