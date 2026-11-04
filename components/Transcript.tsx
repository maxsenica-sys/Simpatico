"use client";
import { useEffect, useRef, useState } from "react";
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
  const [settings, setSettings] = useState(false);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [lines.length]);
  // A dialog takes focus when it opens, so keyboard and screen-reader users land inside it.
  useEffect(() => {
    closeBtn.current?.focus();
  }, []);

  return (
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label={t("transcript")}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="sheet-head">
        <h2>{t("transcript")}</h2>
        <div className="sheet-actions">
          <button
            className={`round-btn ${settings ? "on" : ""}`}
            aria-label={t("captionSettings")}
            title={t("captionSettings")}
            aria-expanded={settings}
            aria-controls="caption-prefs"
            onClick={() => setSettings((v) => !v)}
          >
            Aa
          </button>
          <button
            ref={closeBtn}
            className="round-btn"
            aria-label={t("close")}
            title={t("close")}
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </header>
      {settings && (
        <div className="caption-prefs" id="caption-prefs">
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
          <button
            role="switch"
            aria-checked={prefs.box}
            className={`seg-btn wide ${prefs.box ? "on" : ""}`}
            onClick={() => onPrefs({ ...prefs, box: !prefs.box })}
          >
            {t("captionBox")}
          </button>
          <p className="muted small kbd-hint">{t("shortcuts")}</p>
        </div>
      )}
      <div className="sheet-body" aria-live="polite">
        {lines.length === 0 && <p className="muted">{t("nothingYet")}</p>}
        {lines.map((l) => (
          <div
            key={l.id}
            className={`tline ${l.who} ${l.final ? "" : "live"}`}
            dir="auto"
          >
            {l.who === "me" ? (
              <span className="who">{t("you")}</span>
            ) : (
              names &&
              l.from && <span className="who">{names[l.from] ?? ""}</span>
            )}
            <p>{l.text}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
      {lines.some((l) => l.final) && (
        <footer className="sheet-foot">
          <button className="btn" onClick={onSave}>
            {t("saveTranscript")}
          </button>
        </footer>
      )}
    </div>
  );
}
