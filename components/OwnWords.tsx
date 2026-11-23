"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TranscriptLine } from "@/lib/call";
import { useT } from "@/lib/i18n";

/** Stays on screen while you talk and this long after your last words. */
const SHOW_MS = 4_000;

/**
 * "You": what speech recognition heard you say, so you can check it at a glance. Your recent
 * sentences in a small scrollable panel, newest at the bottom and kept in view as you talk.
 * It shows it can scroll (a scroll bar, a fade at the top and "Scroll for earlier"); scroll
 * back and it stays put, with "Latest" to jump back. Nothing is cut off with "…".
 */
export function OwnWords({ lines, lastAt, speaking, hint }: { lines: TranscriptLine[]; lastAt: number | null; speaking: boolean; hint: boolean }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [bar, setBar] = useState<{ top: number; height: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());

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

  // New words: follow them, unless you've scrolled back to read.
  const text = lines.map((l) => l.text).join("\n");
  useLayoutEffect(() => {
    const el = box.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const visible = lines.length > 0 && (speaking || !atBottom || (lastAt !== null && now - lastAt < SHOW_MS));
  if (!visible) return null;
  return (
    <div className="own-words" dir="auto">
      <div className="own-head">
        <span className="who">{t("you")}</span>
      </div>
      <div className={`own-box ${bar && box.current && box.current.scrollTop > 2 ? "faded" : ""}`} ref={box} onScroll={measure}>
        {lines.map((l, i) => (
          <p key={l.id} className={`${i === lines.length - 1 ? "latest" : ""} ${l.final ? "" : "live"}`}>
            {l.text}
          </p>
        ))}
      </div>
      {bar && (
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
      {hint && <div className="own-hint">{t("captionsCheck")}</div>}
    </div>
  );
}
