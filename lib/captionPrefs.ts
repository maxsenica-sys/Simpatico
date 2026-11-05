"use client";

import type { CaptionStyle } from "@/shared/protocol";

/** Accessibility: caption size, an optional solid backing box and reading style. Remembered on this device. */
export type CaptionSize = "s" | "m" | "l" | "xl";
export type CaptionPrefs = { size: CaptionSize; box: boolean; style: CaptionStyle; focus: boolean };

const KEY = "talk.captions.v1";
export const CAPTION_SIZES: Record<CaptionSize, string> = {
  s: "clamp(22px, 3.4vw, 34px)",
  m: "clamp(28px, 4.2vw, 44px)",
  l: "clamp(34px, 5.2vw, 56px)",
  xl: "clamp(42px, 6.6vw, 70px)",
};

export function loadCaptionPrefs(): CaptionPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<CaptionPrefs>;
    return { size: v.size && v.size in CAPTION_SIZES ? v.size : "m", box: !!v.box, style: v.style === "instant" ? "instant" : "steady", focus: v.focus !== false };
  } catch {
    return { size: "m", box: false, style: "steady", focus: true };
  }
}

export function saveCaptionPrefs(p: CaptionPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}
