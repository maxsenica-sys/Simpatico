"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { BRAND } from "@/shared/brand";

const KEY = "talk.splash";
/** Card up (0.35 s), left bubble, right bubble, name, slogan, a moment to read, fade. */
const TOTAL_MS = 2300;
const FADE_MS = 350;

/**
 * Opening the app: the logo's box pops up from below, its two speech bubbles bounce one after
 * the other (left first, like two people's messages arriving: bing, bing), then the name and the
 * slogan, then the home screen. Once per app open (not when coming back to the home screen), a
 * tap skips it, and it's left out for people who've asked their phone for less motion.
 */
export function Splash() {
  const t = useT();
  // "wait" covers the first paint (so the home screen doesn't flash before the animation).
  const [phase, setPhase] = useState<"wait" | "play" | "fade" | "done">("wait");

  useLayoutEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
      sessionStorage.setItem(KEY, "1");
    } catch {}
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setPhase(seen || calm ? "done" : "play");
  }, []);

  useEffect(() => {
    if (phase === "play") {
      const id = setTimeout(() => setPhase("fade"), TOTAL_MS);
      return () => clearTimeout(id);
    }
    if (phase === "fade") {
      const id = setTimeout(() => setPhase("done"), FADE_MS);
      return () => clearTimeout(id);
    }
  }, [phase]);

  if (phase === "done") return null;
  return (
    <div className={`splash ${phase}`} onClick={() => setPhase("fade")} aria-hidden="true">
      <div className="splash-card">
        <svg viewBox="0 0 48 48" width="112" height="112">
          <g className="splash-bubble left">
            <path d="M17 7h3c7.2 0 13 5.4 13 12s-5.8 12-13 12h-2.5l-6.5 5.5V30A12 12 0 0 1 4 19C4 12.4 9.8 7 17 7z" fill={BRAND.blue} />
          </g>
          <g className="splash-bubble right">
            <path d="M28 15h3c7.2 0 13 5.4 13 12a12 12 0 0 1-7 10.9v5.6L30.5 39H28c-7.2 0-13-5.4-13-12s5.8-12 13-12z" fill={BRAND.mint} fillOpacity="0.88" />
          </g>
        </svg>
        <span className="splash-name">{BRAND.appName.toLowerCase()}</span>
      </div>
      {/* "Different languages." / "Same conversation." on a line each, where the wording splits that way. */}
      <p className="splash-slogan">
        {t("slogan")
          .split(/(?<=[.。!?؟।])\s+/u)
          .map((line, i) => (
            <span key={i}>{line}</span>
          ))}
      </p>
    </div>
  );
}
