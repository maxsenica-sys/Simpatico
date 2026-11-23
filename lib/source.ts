"use client";
/**
 * Where people found Simpatico, so content can be judged by the users it brings, not just views.
 * - A tagged link (the bio links carry ?src=tiktok or ?src=instagram): remembered the first time
 *   this phone opens the app, and sent once.
 * - After the first call: one optional question (TikTok, Instagram, a friend, somewhere else).
 * Nothing else is sent: no name, no contacts, no id.
 */
const LINK_KEY = "talk.src";
const ASKED_KEY = "talk.srcAsked";

const post = (body: object) => {
  try {
    void fetch("/api/source", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  } catch {}
};

export function captureSource() {
  try {
    const src = new URLSearchParams(location.search).get("src");
    if (!src || localStorage.getItem(LINK_KEY)) return;
    const link = src.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
    if (!link) return;
    localStorage.setItem(LINK_KEY, link);
    post({ link });
  } catch {}
}

export function sourceAsked(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return true;
  }
}

export function answerSource(answer: "tiktok" | "instagram" | "friend" | "other" | null) {
  try {
    localStorage.setItem(ASKED_KEY, "1");
  } catch {}
  if (answer) post({ answer });
}
