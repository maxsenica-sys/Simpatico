"use client";

import type { CaptionStyle } from "@/shared/protocol";

/** Accessibility: caption size, an optional solid backing box and reading style. Remembered on this device. */
export type CaptionSize = "s" | "m" | "l" | "xl";
/** `styleSet`: the person picked a reading style themselves (otherwise the default applies). */
/** Long speech: "room" (default) = smaller text and the video moves up; "scroll" = a 2-line window at reading pace. */
export type LongSpeech = "scroll" | "room";
export type CaptionPrefs = { size: CaptionSize; box: boolean; style: CaptionStyle; styleSet?: boolean; focus: boolean; long: LongSpeech };

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
