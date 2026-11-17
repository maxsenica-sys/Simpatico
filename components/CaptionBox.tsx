"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Caption } from "@/lib/call";
import { useT } from "@/lib/i18n";

/** Captions disappear this long after the last words, when nobody is reading back. */
const LAST_LINGER_MS = 20_000;
const FADE_MS = 600;
/** Sentences this close together (same person) are one run of speech, kept whole. */
const RUN_GAP_MS = 3000;
/** Before the current run: only the last few short lines (about two lines' worth). */
const EARLIER_MAX = 3;
/** Lines kept for reading back (a long monologue is many lines). */
const HISTORY = 40;

type Line = Caption & { startAt: number };

/**
 * The other person's words in a box that stays still: the text never changes size, the box
 * never changes height, and new words appear at the bottom, pushing older lines up.
 *
 * Long speech is kept whole, so you can scroll back through it with your finger (a scroll bar
 * and "Scroll for earlier" show there's more; "Latest" jumps back). Short back-and-forth keeps
 * only the last couple of lines before the current sentence: enough to follow, no clutter.
 * While you're reading back, nothing is removed or moved under you.
 */
export function CaptionBox({
  captions,
  names,
  lang,
  speaking,
}: {
  captions: Caption[];
  /** Group calls: speaker names by id, shown before each line. */
  names: Record<string, string> | null;
  lang?: string;
  speaking: boolean;
}) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const history = useRef<Line[]>([]);
  const held = useRef<string[] | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [bar, setBar] = useState<{ top: number; height: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Remember every line (the call keeps settled ones for only 30 s) with when it started.
  const h = history.current;
  for (const c of captions) {
    const i = h.findIndex((x) => x.id === c.id);
    if (i < 0) h.push({ ...c, startAt: c.updatedAt });
    else if (h[i].doneAt === null) h[i] = { ...c, startAt: h[i].startAt };
  }
  if (h.length > HISTORY) h.splice(0, h.length - HISTORY);

  // Which lines to show: the current run whole, plus a little of what came before.
  let shown: Line[] = [];
  if (h.length) {
    let i = h.length - 1;
    while (i > 0) {
      const prev = h[i - 1];
      const cur = h[i];
      const sameRun = prev.from === cur.from && (prev.doneAt === null || cur.startAt - prev.doneAt < RUN_GAP_MS);
      if (!sameRun) break;
      i--;
    }
    const run = h.slice(i);
    const earlier: Line[] = [];
    let chars = 0;
    const lineChars = Math.max(24, Math.round((box.current?.clientWidth ?? 360) / 17));
    for (let j = i - 1; j >= 0 && earlier.length < EARLIER_MAX; j--) {
      // Only recent lines: after a quiet spell the box starts afresh.
      const done = h[j].doneAt;
      if (done !== null && now - done > LAST_LINGER_MS) break;
      chars += h[j].text.length;
      if (earlier.length && chars > lineChars * 2) break;
      earlier.unshift(h[j]);
    }
    shown = [...earlier, ...run];
  }
  // Reading back: keep everything that was on screen, add new lines below it.
  if (!atBottom && held.current) {
    const keep = new Set(held.current);
    const firstShown = shown[0] ? h.indexOf(shown[0]) : h.length;
    const extra = h.filter((x, k) => keep.has(x.id) && k < firstShown);
    shown = [...extra, ...shown];
  }
  held.current = shown.map((x) => x.id);

  const last = shown.at(-1);
  const quiet = !!last && last.doneAt !== null && now - last.doneAt > LAST_LINGER_MS;
  const fading = quiet && atBottom;
  const gone = fading && now - last!.doneAt! > LAST_LINGER_MS + FADE_MS;

  const measure = () => {
    const el = box.current;
    if (!el) return;
    const over = el.scrollHeight - el.clientHeight;
    setAtBottom(over - el.scrollTop < 8);
    if (over <= 2) return setBar(null);
    const height = Math.max(16, (el.clientHeight / el.scrollHeight) * el.clientHeight);
    setBar({ height, top: (el.scrollTop / over) * (el.clientHeight - height) });
  };

  // New words: follow them, unless you've scrolled back to read.
  const sig = shown.map((x) => `${x.id}:${x.text.length}:${x.tail?.length ?? 0}`).join("|");
  useLayoutEffect(() => {
    const el = box.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const scrolledUp = !!bar && !!box.current && box.current.scrollTop > 2;
  const waiting = speaking && !shown.some((c) => c.doneAt === null && (c.stage === "live" || c.tail));
  return (
    <div className="captions-zone boxed">
      {bar && !gone && <span className="cap-scroll-hint">{t("ownScroll")}</span>}
      <div className={`cap-frame ${bar ? "scrollable" : ""}`}>
        <div
          className={`captions cap-box-scroll ${scrolledUp ? "faded" : ""} ${fading ? "fading" : ""}`}
          ref={box}
          onScroll={measure}
          aria-live="polite"
          lang={lang}
        >
          <div className="cap-fill" />
          {!gone &&
            shown.map((c, i) => (
              <p key={c.id} data-id={c.id} className={`cap ${c.doneAt === null ? (c.stage === "steady" ? "steady" : "live") : "done"}`} dir="auto">
                {/* Who is talking: once, where the speaker changes, not on every line. */}
                {names && shown[i - 1]?.from !== c.from && <span className="cap-who">{names[c.from] ?? ""}</span>}
                {c.text}
                {c.tail && (
                  <span className="cap-tail" aria-hidden="true">
                    {c.text ? " " : ""}
                    {c.tail}
                  </span>
                )}
              </p>
            ))}
        </div>
        {bar && !gone && (
          <div className="cap-track-bar" aria-hidden="true">
            <div className="cap-thumb" style={{ top: bar.top, height: bar.height }} />
          </div>
        )}
      </div>
      {!atBottom && (
        <button
          className="cap-latest"
          onClick={() => {
            const el = box.current;
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
          }}
        >
          ↓ {t("ownLatest")}
        </button>
      )}
      {/* They're talking but no words have arrived yet: show that something is coming. */}
      {waiting && (
        <div className="typing" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}
