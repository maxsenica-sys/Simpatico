"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";

/** small: corner preview · big: larger preview · split: the screen shared 50/50 with the other person. */
export type SelfMode = "small" | "big" | "split";
type Corner = "br" | "bl" | "tr" | "tl";

const NEXT: Record<SelfMode, SelfMode> = { small: "big", big: "split", split: "small" };
const CORNER_KEY = "talk.selfCorner";

/**
 * Your own camera. Drag it to any corner; tap it to make it bigger, tap again to split the screen
 * with the other person, and once more to go back to the small preview.
 */
export function SelfView({
  stream,
  mirror,
  low,
  mode,
  onMode,
  onHide,
  hideLabel,
  sizeLabel,
}: {
  stream: MediaStream;
  mirror: string;
  /** Nothing at the bottom of the screen yet (waiting): sit lower. */
  low: boolean;
  mode: SelfMode;
  onMode: (m: SelfMode) => void;
  onHide: () => void;
  hideLabel: string;
  sizeLabel: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; id: number; moved: boolean } | null>(null);
  const [corner, setCorner] = useState<Corner>("br");
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    try {
      const c = localStorage.getItem(CORNER_KEY) as Corner | null;
      if (c && ["br", "bl", "tr", "tl"].includes(c)) setCorner(c);
    } catch {}
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
    // Dropped: snap to the nearest corner.
    const r = box.current?.getBoundingClientRect();
    setOffset(null);
    if (!r) return;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const c = `${cy < window.innerHeight / 2 ? "t" : "b"}${cx < window.innerWidth / 2 ? "l" : "r"}` as Corner;
    setCorner(c);
    try {
      localStorage.setItem(CORNER_KEY, c);
    } catch {}
  };

  return (
    <div
      ref={box}
      className={`self ${mode} c-${corner} ${low ? "low" : ""} ${offset ? "dragging" : ""}`}
      style={offset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
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
      <button className="self-x" aria-label={hideLabel} onClick={onHide}>
        ×
      </button>
    </div>
  );
}
