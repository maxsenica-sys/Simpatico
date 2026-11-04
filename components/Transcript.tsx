"use client";
import { useEffect, useRef } from "react";
import type { TranscriptLine } from "@/lib/call";
import type { CaptionPrefs, CaptionSize } from "@/lib/captionPrefs";
import { useT } from "@/lib/i18n";

const SIZES: CaptionSize[] = ["s", "m", "l", "xl"];

export function Transcript({
  lines,
  names,
  prefs,
  onPrefs,
  onSave,
  onClose,
}: {
  lines: TranscriptLine[];
  names: Record<string, string> | null;
  prefs: CaptionPrefs;
  onPrefs: (p: CaptionPrefs) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const end = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [lines.length]);
  // A dialog takes focus when it opens, so keyboard and screen-reader users land inside it.
  useEffect(() => {
    closeBtn.current?.focus();
  }, []);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={t("transcript")} onClick={(e) => e.stopPropagation()}>
      <header className="sheet-head">
        <h2>{t("transcript")}</h2>
        <div className="sheet-actions">
          {lines.some((l) => l.final) && (
            <button className="btn small" onClick={onSave}>
              {t("saveTranscript")}
            </button>
          )}
          <button ref={closeBtn} className="btn small" onClick={onClose}>
            {t("close")}
          </button>
        </div>
      </header>
      <div className="caption-prefs">
        <div className="seg" role="radiogroup" aria-label={t("captionSize")}>
          <span className="muted small">{t("captionSize")}</span>
          {SIZES.map((s, i) => (
            <button
              key={s}
              role="radio"
              aria-checked={prefs.size === s}
              className={`seg-btn ${prefs.size === s ? "on" : ""}`}
              style={{ fontSize: `${0.8 + i * 0.18}rem` }}
              onClick={() => onPrefs({ ...prefs, size: s })}
            >
              A
            </button>
          ))}
        </div>
        <label className="check small-check">
          <input type="checkbox" checked={prefs.box} onChange={(e) => onPrefs({ ...prefs, box: e.target.checked })} />
          <span>{t("captionBox")}</span>
        </label>
        <p className="muted small kbd-hint">{t("shortcuts")}</p>
      </div>
      <div className="sheet-body" aria-live="polite">
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
