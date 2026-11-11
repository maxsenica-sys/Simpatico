"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

/**
 * The quickest possible "can they hear and see me?" check, built into the camera preview:
 * a live sound meter that turns green ("Mic works") as soon as it hears you, a camera tick, and
 * an optional one-tap test sound for the speaker. Nothing to wait for; joining is never blocked.
 */
export function MediaCheck({ stream }: { stream: MediaStream }) {
  const t = useT();
  const [level, setLevel] = useState(0);
  const [micOk, setMicOk] = useState(false);
  const [camOk, setCamOk] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const hasMic = stream.getAudioTracks().length > 0;
  const hasCam = stream.getVideoTracks().length > 0;

  useEffect(() => {
    const v = stream.getVideoTracks()[0];
    const tick = () => setCamOk(!!v && v.readyState === "live" && !v.muted);
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [stream]);

  useEffect(() => {
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    let raf = 0;
    let heard = 0;
    let last = 0;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    ctxRef.current = ctx;
    const src = ctx.createMediaStreamSource(new MediaStream([track]));
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    // iPhones start audio paused until a tap: any tap on the page wakes the meter.
    const wake = () => void ctx.resume().catch(() => {});
    document.addEventListener("pointerdown", wake, { once: true });
    void ctx.resume().catch(() => {});
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 70) return;
      last = now;
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const x of buf) sum += x * x;
      const db = 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-9);
      // -60 dB (silence) .. -15 dB (talking close) -> 0..1
      const l = Math.max(0, Math.min(1, (db + 60) / 45));
      setLevel(l);
      heard = l > 0.35 ? heard + 1 : Math.max(0, heard - 1);
      if (heard >= 3) setMicOk(true);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("pointerdown", wake);
      src.disconnect();
      void ctx.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [stream]);

  const testSound = () => {
    const ctx = ctxRef.current ?? new AudioContext();
    void ctx.resume().catch(() => {});
    const t0 = ctx.currentTime + 0.03;
    [523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      const s = t0 + i * 0.13;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.2, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(s);
      o.stop(s + 0.28);
    });
  };

  if (!hasMic && !hasCam) return null;
  const bars = 5;
  return (
    <div className="media-check" aria-live="polite">
      {hasCam && (
        <span className={`mc-pill ${camOk ? "ok" : ""}`}>
          <CamGlyph />
          {camOk ? t("camOk") : t("cameraStarting")}
        </span>
      )}
      {hasMic && (
        <span className={`mc-pill ${micOk ? "ok" : ""}`}>
          <MicGlyph />
          <span className="mc-bars" aria-hidden="true">
            {Array.from({ length: bars }, (_, i) => (
              <i key={i} className={level * bars > i + 0.3 ? "on" : ""} />
            ))}
          </span>
          {micOk ? t("micOk") : t("micSaySomething")}
        </span>
      )}
      <button type="button" className="mc-pill mc-test" onClick={testSound}>
        <SpeakerGlyph />
        {t("testSound")}
      </button>
    </div>
  );
}

const G = { viewBox: "0 0 24 24", width: 15, height: 15, fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
function MicGlyph() {
  return (
    <svg {...G}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  );
}
function CamGlyph() {
  return (
    <svg {...G}>
      <rect x="2.5" y="6" width="13" height="12" rx="3" />
      <path d="M15.5 10.5 21 7.5v9l-5.5-3" />
    </svg>
  );
}
function SpeakerGlyph() {
  return (
    <svg {...G}>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  );
}
