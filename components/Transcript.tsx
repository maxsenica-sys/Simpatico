"use client";
import { useEffect, useRef } from "react";
import type { TranscriptLine } from "@/lib/call";
import { useT } from "@/lib/i18n";

export function Transcript({ lines, names, onClose }: { lines: TranscriptLine[]; names: Record<string, string> | null; onClose: () => void }) {
  const t = useT();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [lines.length]);
  return (
    <div className="sheet" onClick={(e) => e.stopPropagation()}>
      <header className="sheet-head">
        <h2>{t("transcript")}</h2>
        <button className="btn" onClick={onClose}>
          {t("close")}
        </button>
      </header>
      <div className="sheet-body">
        {lines.length === 0 && <p className="muted">{t("nothingYet")}</p>}
        {lines.map((l) => (
          <div key={l.id} className={`tline ${l.who} ${l.final ? "" : "live"}`} dir="auto">
            {l.who === "me" ? <span className="who">{t("you")}</span> : names && l.from && <span className="who">{names[l.from] ?? ""}</span>}
            <p>{l.text}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
    </div>
  );
}
