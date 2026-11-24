"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";

/** small: corner preview · big: larger preview · split: the screen shared 50/50 with the other person. */
export type SelfMode = "small" | "big" | "split";
/** Which side it sits on, and how far down (0 = as high as it goes, 1 = just above the captions). */
type Place = { side: "l" | "r"; y: number };

const NEXT: Record<SelfMode, SelfMode> = { small: "big", big: "split", split: "small" };
const PLACE_KEY = "talk.selfPlace";
const OLD_CORNER_KEY = "talk.selfCorner";

/**
 * Your own camera. Drag it anywhere along either side (it tucks against the nearer edge, at the
 * height you leave it, between the top bar and the captions); tap it to make it bigger, tap again to split the screen
 * with the other person, and once more to go back to the small preview. The round arrows on it
 * switch between the front and back cameras (turning the camera off is the Camera button up top).
 */
export function SelfView({
  stream,
  mirror,
  low,
  mode,
  onMode,
  onFlip,
  flipLabel,
  sizeLabel,
}: {
  stream: MediaStream;
  mirror: string;
  /** Nothing at the bottom of the screen yet (waiting): sit lower. */
  low: boolean;
  mode: SelfMode;
  onMode: (m: SelfMode) => void;
  /** Switch between the front and back cameras (absent when the device has only one). */
  onFlip?: () => void;
  flipLabel: string;
  sizeLabel: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; id: number; moved: boolean } | null>(null);
  const [place, setPlace] = useState<Place>({ side: "r", y: 1 });
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PLACE_KEY) ?? "null") as Place | null;
      if (saved && (saved.side === "l" || saved.side === "r") && typeof saved.y === "number") return setPlace({ side: saved.side, y: Math.min(1, Math.max(0, saved.y)) });
      // From before: one of four corners.
      const c = localStorage.getItem(OLD_CORNER_KEY);
      if (c && /^[tb][lr]$/.test(c)) setPlace({ side: c[1] as "l" | "r", y: c[0] === "t" ? 0 : 1 });
    } catch {}
  }, []);
  // Its own height, for placing it between the top and the captions (it changes with the size).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const v = video.current;
    if (v && v.srcObject !== stream) {
      v.srcObject = stream;
      v.play().catch(() => {});
    }
  }, [stream, mode]);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
    box.current?.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || mode === "split") return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 8) return;
    d.moved = true;
    setOffset({ x: dx, y: dy });
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved) return onMode(NEXT[mode]); // a tap: next size
    // Dropped: against the nearer side, at the height it was left (within the free band).
    const el = box.current;
    const r = el?.getBoundingClientRect();
    setOffset(null);
    if (!el || !r) return;
    const band = freeBand(el, low);
    const room = band.bottom - band.top - r.height;
    const next: Place = { side: r.left + r.width / 2 < window.innerWidth / 2 ? "l" : "r", y: room > 0 ? Math.min(1, Math.max(0, (r.top - band.top) / room)) : 1 };
    setPlace(next);
    try {
      localStorage.setItem(PLACE_KEY, JSON.stringify(next));
    } catch {}
  };

  return (
    <div
      ref={box}
      className={`self ${mode} s-${place.side} ${low ? "low" : ""} ${offset ? "dragging" : ""}`}
      style={{ ["--y" as string]: place.y, ["--h" as string]: `${height}px`, ...(offset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : {}) }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => {
        drag.current = null;
        setOffset(null);
      }}
      onClick={(e) => e.stopPropagation()}
      role="button"
      aria-label={sizeLabel}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onMode(NEXT[mode]);
        }
      }}
    >
      <video ref={video} className={mirror} autoPlay playsInline muted />
      {onFlip && (
        <button className="self-flip" aria-label={flipLabel} title={flipLabel} onClick={onFlip}>
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 11a8 8 0 0 0-14.3-4.2L4 9" />
            <path d="M4 4v5h5" />
            <path d="M4 13a8 8 0 0 0 14.3 4.2L20 15" />
            <path d="M20 20v-5h-5" />
          </svg>
        </button>
      )}
    </div>
  );
}

/** Where it may sit, on screen: below the top bar, above the captions (as the stylesheet works it out). */
function freeBand(el: HTMLElement, low: boolean): { top: number; bottom: number } {
  const probe = document.createElement("div");
  probe.className = `self self-probe ${low ? "low" : ""}`;
  el.parentElement?.appendChild(probe);
  const r = probe.getBoundingClientRect();
  probe.remove();
  return { top: r.top, bottom: r.bottom };
}
