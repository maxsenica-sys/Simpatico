"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TranscriptLine } from "@/lib/call";
import { useT } from "@/lib/i18n";

/** Stays open while you talk and this long after your last words. */
const SHOW_MS = 4_000;
/** Opened by touching it: stays open this long after your last touch. */
const TOUCH_MS = 6_000;

/**
 * "You": what speech recognition heard you say, so you can check it at a glance, and scroll back
 * through it if a word came out wrong. A small box under the buttons. At rest it is one faint
 * line (your last words); while you talk, or when you touch it, it grows to a few lines (no more,
 * so the other person stays in view) with a scroll bar, and you can scroll back through what you
 * said; "Latest" jumps back. Left alone, it settles to one line again. Nothing is cut off with "…".
 */
export function OwnWords({ lines, lastAt, speaking, hint }: { lines: TranscriptLine[]; lastAt: number | null; speaking: boolean; hint: boolean }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [bar, setBar] = useState<{ top: number; height: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [touchedAt, setTouchedAt] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const measure = () => {
    const el = box.current;
    if (!el) return;
    const over = el.scrollHeight - el.clientHeight;
    setAtBottom(over - el.scrollTop < 8);
    if (over <= 2) return setBar(null);
    const height = Math.max(14, (el.clientHeight / el.scrollHeight) * el.clientHeight);
    setBar({ height, top: (el.scrollTop / over) * (el.clientHeight - height) });
  };

  const touched = now - touchedAt < TOUCH_MS;
  const talking = speaking || (lastAt !== null && now - lastAt < SHOW_MS);
  // Open: talking, just touched, or scrolled back to read. Otherwise it rests on one line.
  const open = talking || touched || !atBottom;

  // New words, or the box changing size: follow the newest words, unless you've scrolled back to read.
  const text = lines.map((l) => l.text).join("\n");
  useLayoutEffect(() => {
    const el = box.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
    measure();
    // The box grows over a moment: once it has, the newest words should still be the ones in view.
    const id = setTimeout(() => {
      const e = box.current;
      if (e && atBottom) e.scrollTop = e.scrollHeight;
      measure();
    }, 240);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, open]);

  if (lines.length === 0) return null;
  const touch = () => setTouchedAt(Date.now());
  return (
    <div className={`own-words ${open ? "open" : "rest"} ${touched || !atBottom ? "reading" : ""}`} dir="auto" onPointerDown={touch}>
      <div className="own-head">
        <span className="who">{t("you")}</span>
      </div>
      <div
        className={`own-box ${open && bar && box.current && box.current.scrollTop > 2 ? "faded" : ""}`}
        ref={box}
        onScroll={() => {
          measure();
          // Scrolling it (not our own follow-the-newest) counts as a touch.
          const el = box.current;
          if (el && el.scrollHeight - el.clientHeight - el.scrollTop >= 8) touch();
        }}
      >
        {lines.map((l, i) => (
          <p key={l.id} className={`${i === lines.length - 1 ? "latest" : ""} ${l.final ? "" : "live"}`}>
            {l.text}
          </p>
        ))}
      </div>
      {open && bar && (
        <div className="own-track" aria-hidden="true">
          <div className="own-thumb" style={{ top: bar.top, height: bar.height }} />
        </div>
      )}
      {!atBottom && (
        <button
          className="own-latest"
          onClick={() => {
            const el = box.current;
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
          }}
        >
          ↓ {t("ownLatest")}
        </button>
      )}
      {hint && open && <div className="own-hint">{t("captionsCheck")}</div>}
    </div>
  );
}
