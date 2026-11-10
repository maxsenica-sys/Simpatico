"use client";
import { isNativeApp } from "./env";

export type MediaFailure = "denied" | "no-device" | "maybe-in-app" | "other";

export const AUDIO: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
  // Browsers with built-in voice isolation (recent Chrome on some platforms) keep the nearest
  // voice and drop the room; others ignore this.
  ...({ voiceIsolation: true } as MediaTrackConstraints),
};

/** Phones and tablets: lighter video, so long calls (especially while charging) don't overheat. */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function videoConstraints(facing: "user" | "environment" = "user"): MediaTrackConstraints {
  // 960x540 at 24 fps is ~45% less encoding work than 1280x720 at 30, and still sharp on a phone.
  const mobile = isMobileDevice();
  return {
    facingMode: { ideal: facing },
    width: { ideal: mobile ? 960 : 1280 },
    height: { ideal: mobile ? 540 : 720 },
    frameRate: { ideal: mobile ? 24 : 30, max: mobile ? 24 : 30 },
  };
}

/**
 * One getUserMedia for the whole call: this stream's audio track feeds both the
 * RTCPeerConnection and the caption tap. Falls back to audio-only if there's no camera.
 */
export async function getLocalMedia(ios: boolean): Promise<MediaStream | MediaFailure> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: AUDIO, video: videoConstraints() });
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === "NotAllowedError" || name === "SecurityError") return "denied";
    if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: AUDIO });
      } catch (err2) {
        const n2 = (err2 as DOMException)?.name;
        if (n2 === "NotAllowedError") return "denied";
        return n2 === "NotFoundError" ? "no-device" : "other";
      }
    }
    // Embedded iOS browsers fail in odd ways (TypeError, AbortError) rather than asking.
    return ios && !isNativeApp() ? "maybe-in-app" : "other";
  }
}

/** A fresh camera track: turning the camera back on, switching cameras, or recovering one iOS ended. */
export async function getCameraTrack(facing: "user" | "environment"): Promise<MediaStreamTrack> {
  const s = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(facing) });
  return s.getVideoTracks()[0];
}

/** Only used when the original mic track has ended (e.g. iOS ended it in the background). */
export async function getMicTrack(): Promise<MediaStreamTrack> {
  const s = await navigator.mediaDevices.getUserMedia({ audio: AUDIO });
  return s.getAudioTracks()[0];
}

export async function hasMultipleCameras(): Promise<boolean> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "videoinput").length > 1;
  } catch {
    return false;
  }
}
