"use client";

export type MediaFailure = "denied" | "no-device" | "maybe-in-app" | "other";

const AUDIO: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};
const VIDEO: MediaTrackConstraints = {
  facingMode: "user",
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30, max: 30 },
};

/**
 * One getUserMedia for the whole call: this stream's audio track feeds both the
 * RTCPeerConnection and the caption tap. Falls back to audio-only if there's no camera.
 */
export async function getLocalMedia(ios: boolean): Promise<MediaStream | MediaFailure> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: AUDIO, video: VIDEO });
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
    return ios ? "maybe-in-app" : "other";
  }
}
