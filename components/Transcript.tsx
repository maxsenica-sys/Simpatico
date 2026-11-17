"use client";
import { useEffect, useRef, useState } from "react";
import type { MediaError, MediaRef, TranscriptLine } from "@/lib/call";
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
  onType,
  onMedia,
}: {
  lines: TranscriptLine[];
  names: Record<string, string> | null;
  prefs: CaptionPrefs;
  onPrefs: (p: CaptionPrefs) => void;
  onSave: () => void;
  onClose: () => void;
  /** "Not right?" on a received line: send it to improve translations. */
  onReport?: (id: string) => void;
  /** Type to talk; returns false when it couldn't be sent. */
  onType?: (text: string) => boolean;
  /** Send a photo or video into the messages; resolves with what went wrong, if anything. */
  onMedia?: (file: File) => Promise<MediaError | null>;
}) {
  const t = useT();
  const end = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [settings, setSettings] = useState(false);
  const [reported, setReported] = useState<Set<string>>(() => new Set());
  const [draft, setDraft] = useState("");
  const [view, setView] = useState<MediaRef | null>(null);
  const [mediaError, setMediaError] = useState<MediaError | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const pick = async (files: FileList | null) => {
    if (!files || !onMedia) return;
    setMediaError(null);
    for (const f of Array.from(files).slice(0, 10)) {
      const err = await onMedia(f);
      if (err) setMediaError(err);
    }
    if (picker.current) picker.current.value = "";
  };
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
            {l.media ? <MediaBubble m={l.media} onOpen={() => setView(l.media!)} /> : <p>{l.text}</p>}
            {onReport && l.who === "them" && l.final && !l.media && (
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
      <footer className="sheet-foot">
        {mediaError && (
          <p className="media-error" role="alert">
            {t(mediaError === "too-big" ? "mediaTooBig" : mediaError === "bad-type" ? "mediaBadType" : mediaError === "offline" ? "mediaOffline" : "mediaFailedLong")}
          </p>
        )}
        {onType && (
          <form
            className="type-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim() && onType(draft)) setDraft("");
            }}
          >
            {onMedia && (
              <>
                <button type="button" className="attach-btn" aria-label={t("attachMedia")} title={t("attachMedia")} onClick={() => picker.current?.click()}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="3" />
                    <circle cx="9" cy="10" r="1.8" />
                    <path d="M21 16l-5.5-5.5L7 19" />
                  </svg>
                </button>
                <input ref={picker} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => pick(e.target.files)} />
              </>
            )}
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("typePlaceholder")}
              aria-label={t("typePlaceholder")}
              maxLength={300}
              enterKeyHint="send"
              autoComplete="off"
            />
            <button className="btn primary small" type="submit" disabled={!draft.trim()}>
              {t("typeSend")}
            </button>
          </form>
        )}
        {lines.some((l) => l.final) && (
          <button className="btn small" onClick={onSave}>
            {t("saveTranscript")}
          </button>
        )}
      </footer>
      {view && <MediaViewer m={view} onClose={() => setView(null)} />}
    </div>
  );
}

/** A photo or video in the messages: tap to see it full size. Shows progress while it's sending. */
function MediaBubble({ m, onOpen }: { m: MediaRef; onOpen: () => void }) {
  const t = useT();
  return (
    <div className="media-bubble">
      <button className="media-thumb" onClick={onOpen} aria-label={t(m.kind === "image" ? "mediaPhoto" : "mediaVideo")}>
        {m.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.url} alt="" loading="lazy" />
        ) : (
          <>
            <video src={`${m.url}#t=0.1`} preload="metadata" muted playsInline />
            <span className="media-play" aria-hidden="true">▶</span>
          </>
        )}
      </button>
      {m.progress !== undefined && <span className="media-status">{t("mediaSending", { pct: String(Math.round(m.progress * 100)) })}</span>}
      {m.failed && <span className="media-status failed">{t("mediaFailed")}</span>}
    </div>
  );
}

/** Full screen, with Save. */
function MediaViewer({ m, onClose }: { m: MediaRef; onClose: () => void }) {
  const t = useT();
  return (
    <div className="media-viewer" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="media-viewer-body" onClick={(e) => e.stopPropagation()}>
        {m.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.url} alt="" />
        ) : (
          <video src={m.url} controls autoPlay playsInline />
        )}
      </div>
      <div className="media-viewer-bar" onClick={(e) => e.stopPropagation()}>
        <a className="btn small" href={m.url} download>
          {t("mediaSave")}
        </a>
        <span className="muted small">{t("mediaKept")}</span>
        <button className="round-btn" aria-label={t("close")} onClick={onClose}>
          ×
        </button>
      </div>
    </div>
  );
}
