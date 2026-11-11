"use client";
import { useEffect, useRef, useState } from "react";
import type { TranscriptLine } from "@/lib/call";
import type { CaptionPrefs } from "@/lib/captionPrefs";
import { CaptionSettings } from "./CaptionSettings";
import { useT } from "@/lib/i18n";

export function Transcript({
  lines,
  names,
  prefs,
  onPrefs,
  onSave,
  onClose,
  onReport,
}: {
  lines: TranscriptLine[];
  names: Record<string, string> | null;
  prefs: CaptionPrefs;
  onPrefs: (p: CaptionPrefs) => void;
  onSave: () => void;
  onClose: () => void;
  /** "Not right?" on a received line: send it to improve translations. */
  onReport?: (id: string) => void;
}) {
  const t = useT();
  const end = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [settings, setSettings] = useState(false);
  const [reported, setReported] = useState<Set<string>>(() => new Set());
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
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
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
          <CaptionSettings prefs={prefs} onPrefs={onPrefs} />
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
            {onReport && l.who === "them" && l.final && (
              <button
                className={`report-btn ${reported.has(l.id) ? "done" : ""}`}
                disabled={reported.has(l.id)}
                onClick={() => {
                  onReport(l.id);
                  setReported((r) => new Set(r).add(l.id));
                }}
              >
                {reported.has(l.id) ? t("reportThanks") : t("reportWrong")}
              </button>
            )}
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
