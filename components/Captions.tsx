"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Caption } from "@/lib/call";
import { useT } from "@/lib/i18n";

/** A finished line stays this long once a newer one is showing… */
const LINGER_MS = 8000;
/** …and the newest line stays this long when nobody says anything new. */
const LAST_LINGER_MS = 20_000;
const FADE_MS = 600;
const MAX_UTTERANCES = 4;
/** Reading pace for the scrolling window: about a third of a second a word, 1.3 to 4 s a line. */
const MS_PER_WORD = 320;
const MIN_LINE_MS = 1300;
const MAX_LINE_MS = 4000;

/**
 * Captions over the bottom of the video, "Paced" style (the default is CaptionBox).
 *
 * A 2-line window (3 on tall phones). New words appear at the bottom; when
 * the window is full, the text moves up one line at a time, never faster than it can be read.
 * If they talk faster than that, lines wait and catch up (twice as fast) until the next pause.
 * "Earlier" opens the transcript. Each chunk is translated once and never rewritten (lib/call),
 * so a line that has moved up never changes under your eyes.
 */
export function Captions({
  captions,
  names,
  lang,
  speaking,
  onEarlier,
}: {
  captions: Caption[];
  /** Group calls: speaker names by id, shown before each line. */
  names: Record<string, string> | null;
  /** The reader's language, so screen readers pronounce the captions correctly. */
  lang?: string;
  speaking: boolean;
  onEarlier?: () => void;
}) {
  const t = useT();
  const win = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const frozen = useRef(new Map<string, string>());
  const heights = useRef(new Map<string, number>());
  const firstId = useRef<string | null>(null);
  const offset = useRef(0);
  const lastMove = useRef(0);
  const [, setTick] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const shown = captions
    .map((c) => (frozen.current.has(c.id) ? { ...c, text: frozen.current.get(c.id)! } : c))
    .filter((c, i, all) => c.doneAt === null || now - c.doneAt < (i === all.length - 1 ? LAST_LINGER_MS : LINGER_MS) + FADE_MS)
    .slice(-MAX_UTTERANCES);

  useLayoutEffect(() => {
    const w = win.current;
    const tr = track.current;
    if (!w || !tr) return;
    const kids = Array.from(tr.children) as HTMLElement[];

    // A line that left the top of the list (it faded out): the text below it moved up by its
    // height, so the window moves with it instead of jumping.
    const first = kids[0]?.dataset.id ?? null;
    if (firstId.current && first !== firstId.current && !kids.some((k) => k.dataset.id === firstId.current)) {
      offset.current = Math.max(0, offset.current - (heights.current.get(firstId.current) ?? 0));
    }
    firstId.current = first;
    for (const k of kids) if (k.dataset.id) heights.current.set(k.dataset.id, k.offsetHeight);
    if (heights.current.size > 60) heights.current = new Map([...heights.current].slice(-20));

    const total = tr.scrollHeight;
    {
      // Where each line really starts (lines differ slightly in height), so the window always
      // shows whole lines.
      const trTop = tr.getBoundingClientRect().top;
      const tops = new Set<number>([0]);
      for (const k of kids) {
        const r = document.createRange();
        r.selectNodeContents(k);
        for (const rect of Array.from(r.getClientRects())) tops.add(Math.round(rect.top - trTop));
      }
      const starts = [...tops].sort((x, y) => x - y);
      const fits = (o: number) => total - o <= w.clientHeight + 1;
      const target = starts.find(fits) ?? Math.max(0, total - w.clientHeight);
      if (target < offset.current) offset.current = target;
      else if (target > offset.current) {
        const words = (tr.textContent ?? "").split(/\s+/).filter(Boolean).length;
        const lines = Math.max(1, starts.length);
        const perLine = Math.min(MAX_LINE_MS, Math.max(MIN_LINE_MS, (words / lines) * MS_PER_WORD));
        const backlog = starts.filter((t) => t > offset.current && t <= target).length;
        const wait = backlog > 2 ? perLine / 2 : perLine;
        const t0 = Date.now();
        // A new run after a pause starts right away; otherwise one line per reading time.
        if (t0 - lastMove.current >= wait || offset.current === 0) {
          offset.current = starts.find((t) => t > offset.current) ?? target;
          lastMove.current = t0;
        }
      }
    }
    tr.style.transform = `translateY(${-offset.current}px)`;

    // Freeze any line that has moved fully above the window: a late refinement can't change it.
    kids.forEach((k) => {
      const id = k.dataset.id;
      if (!id || k === kids[kids.length - 1]) return;
      if (k.offsetTop + k.offsetHeight <= offset.current + 2 && !frozen.current.has(id)) {
        const c = shown.find((x) => x.id === id);
        if (c) frozen.current.set(id, c.text);
      }
    });
    if (frozen.current.size > 50) frozen.current = new Map([...frozen.current].slice(-20));
  });

  // Keep the pacing moving between caption updates.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, []);

  const scrolled = offset.current > 2;
  return (
    <div className="captions-zone scroll">
      {scrolled && onEarlier && (
        <button className="cap-earlier" onClick={onEarlier}>
          ↑ {t("earlier")}
        </button>
      )}
      <div className="captions" ref={win} aria-live="polite" lang={lang}>
        <div className="cap-track" ref={track}>
          {shown.map((c, i) => {
            const fading = c.doneAt !== null && now - c.doneAt > (i === shown.length - 1 ? LAST_LINGER_MS : LINGER_MS);
            return (
              <p key={c.id} data-id={c.id} className={`cap ${c.doneAt === null ? (c.stage === "steady" ? "steady" : "live") : "done"} ${fading ? "fading" : ""}`} dir="auto">
                {names && <span className="cap-who">{names[c.from] ?? ""}</span>}
                {c.text}
                {c.tail && (
                  <span className="cap-tail" aria-hidden="true">
                    {c.text ? " " : ""}
                    {c.tail}
                  </span>
                )}
              </p>
            );
          })}
        </div>
      </div>
      {/* They're talking but no words have arrived yet: show that something is coming. */}
      {speaking && !shown.some((c) => c.doneAt === null && (c.stage === "live" || c.tail)) && (
        <div className="typing" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}
