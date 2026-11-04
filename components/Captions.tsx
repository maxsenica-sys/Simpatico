"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Caption } from "@/lib/call";

/** A settled line stays this long, then fades. */
const LINGER_MS = 6000;
const FADE_MS = 600;
const MAX_UTTERANCES = 3;

/**
 * Bottom-centre captions on the video, max 3 lines. Pass-1/live text is 60% opacity, settled
 * text 100%. A line that has already scrolled out of view is frozen: a late refinement can't
 * pull it back or reflow what the reader is looking at.
 */
export function Captions({
  captions,
  names,
  lang,
  speaking,
}: {
  captions: Caption[];
  /** Group calls: speaker names by id, shown before each line. */
  names: Record<string, string> | null;
  /** The reader's language, so screen readers pronounce the captions correctly. */
  lang?: string;
  speaking: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const frozen = useRef(new Map<string, string>());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const shown = captions
    .map((c) => (frozen.current.has(c.id) ? { ...c, text: frozen.current.get(c.id)! } : c))
    .filter((c) => c.doneAt === null || now - c.doneAt < LINGER_MS + FADE_MS)
    .slice(-MAX_UTTERANCES);

  // After layout, freeze the text of any older line that is no longer fully inside the
  // 3-line window. The newest line is never frozen, so a long live utterance keeps updating.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    const children = Array.from(el.children) as HTMLElement[];
    children.slice(0, -1).forEach((child) => {
      const id = child.dataset.id;
      if (!id) return;
      if (child.getBoundingClientRect().top < top - 2 && !frozen.current.has(id)) {
        const c = shown.find((x) => x.id === id);
        if (c) frozen.current.set(id, c.text);
      }
    });
    if (frozen.current.size > 50) frozen.current = new Map([...frozen.current].slice(-20));
  });

  return (
    <div className="captions-zone">
      <div className="captions" ref={box} aria-live="polite" lang={lang}>
        {shown.map((c) => {
          const fading = c.doneAt !== null && now - c.doneAt > LINGER_MS;
          return (
            <p key={c.id} data-id={c.id} className={`cap ${c.doneAt === null ? "live" : "done"} ${fading ? "fading" : ""}`} dir="auto">
              {names && <span className="cap-who">{names[c.from] ?? ""}</span>}
              {c.text}
            </p>
          );
        })}
      </div>
      {/* They're talking but no words have arrived yet: show that something is coming.
          Kept outside the 3-line box so it never pushes a caption line out of view. */}
      {speaking && !shown.some((c) => c.doneAt === null) && (
        <div className="typing" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}
