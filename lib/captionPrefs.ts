"use client";

import type { CaptionStyle } from "@/shared/protocol";

/** Accessibility: caption size, an optional solid backing box and reading style. Remembered on this device. */
export type CaptionSize = "s" | "m" | "l" | "xl";
/** `styleSet`: the person picked a reading style themselves (otherwise the default applies). */
/** Long speech: "room" (default) = a fixed box you can scroll back through; "scroll" = a 2-line window at reading pace. */
export type LongSpeech = "scroll" | "room";
export type CaptionPrefs = { size: CaptionSize; box: boolean; style: CaptionStyle; styleSet?: boolean; focus: boolean; long: LongSpeech };

const KEY = "talk.captions.v1";
/** Medium (the default) is small enough to keep a few lines of a long sentence in view. */
export const CAPTION_SIZES: Record<CaptionSize, string> = {
  s: "clamp(19px, 2.9vw, 30px)",
  m: "clamp(24px, 3.6vw, 38px)",
  l: "clamp(29px, 4.5vw, 48px)",
  xl: "clamp(36px, 5.7vw, 60px)",
};

export function loadCaptionPrefs(): CaptionPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<CaptionPrefs>;
    // Live is the default; Steady only when the person chose it.
    const style: CaptionStyle = v.styleSet && v.style === "steady" ? "steady" : "instant";
    return { size: v.size && v.size in CAPTION_SIZES ? v.size : "m", box: !!v.box, style, styleSet: !!v.styleSet, focus: v.focus !== false, long: v.long === "scroll" ? "scroll" : "room" };
  } catch {
    return { size: "m", box: false, style: "instant", focus: true, long: "room" };
  }
}

export function saveCaptionPrefs(p: CaptionPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}
