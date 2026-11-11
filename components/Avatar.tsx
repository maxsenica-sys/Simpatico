import type { CSSProperties, ReactNode } from "react";

/** A round picture of someone: their photo if we have one, otherwise their initials. */
export function Avatar({ photo, fallback, className = "avatar", style }: { photo?: string | null; fallback: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span className={`${className} ${photo ? "has-photo" : ""}`} style={photo ? undefined : style} aria-hidden="true">
      {photo ? <img src={photo} alt="" draggable={false} /> : fallback}
    </span>
  );
}
