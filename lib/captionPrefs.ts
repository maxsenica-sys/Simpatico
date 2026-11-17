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
  s: "clamp(17px, 2.6vw, 26px)",
  m: "clamp(21px, 3.2vw, 34px)",
  l: "clamp(27px, 4.2vw, 44px)",
  xl: "clamp(34px, 5.4vw, 58px)",
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
