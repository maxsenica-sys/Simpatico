"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { isNativeApp } from "@/lib/env";
import { RECOVERY_DAYS, clearTalks, deleteTalk, keepTalk, keepsTalks, listDrafts, listTalks, setKeepTalks, talkText, type SavedTalk } from "@/lib/saved";
import { saveTranscript } from "@/lib/transcriptFile";
import { langInfo } from "@/shared/lang";

/** "2026-11-27-10-52" for a file name. */
const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace(/[:T]/g, "-");

/**
 * Me page: the switch for keeping conversations on this phone, and the ones kept so far. Each
 * opens to read (both languages where we have them), save as a file, or delete.
 */
export function SavedTalks() {
  const t = useT();
  const [keep, setKeep] = useState(false);
  const [talks, setTalks] = useState<SavedTalk[] | null>(null);
  const [open, setOpen] = useState<SavedTalk | null>(null);
  const [all, setAll] = useState(false);
  const [drafts, setDrafts] = useState<SavedTalk[]>([]);
  const [native, setNative] = useState(false);
  const refresh = () => {
    void listTalks().then(setTalks);
    void listDrafts().then(setDrafts);
  };
  useEffect(() => {
    setKeep(keepsTalks());
    setNative(isNativeApp());
    refresh();
  }, []);
  const kindName = (k: SavedTalk["kind"]) => t(k === "inperson" ? "talkInPerson" : k === "group" ? "talkGroup" : "talkCall");
  const title = (x: SavedTalk) => (x.with.length ? x.with.join(", ") : kindName(x.kind));
  const sub = (x: SavedTalk) => {
    const mins = Math.max(1, Math.round((x.endedAt - x.startedAt) / 60000));
    const langs = x.langs.filter(Boolean).map((l) => langInfo(l).native).join(" · ");
    return `${new Date(x.startedAt).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ${t("minutesShort", { n: String(mins) })}${langs ? ` · ${langs}` : ""}`;
  };
  const shown = talks ? (all ? talks : talks.slice(0, 5)) : [];
  return (
    <details className="pgroup">
      <summary>
        <span>
          {t("savedTalks")}
          <small>{talks && talks.length ? `${t("savedTalksSub")} · ${talks.length}` : t("savedTalksSub")}</small>
        </span>
      </summary>
      <div className="pgroup-body">
      <label className="switch-row">
        <span>{t("keepTalks")}</span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          checked={keep}
          onChange={(e) => {
            setKeep(e.target.checked);
            setKeepTalks(e.target.checked);
          }}
        />
      </label>
      <p className="muted small">{t("keepTalksHint")}</p>
      {talks && talks.length === 0 && keep && <p className="muted small">{t("noSavedTalks")}</p>}
      {shown.length > 0 && (
        <ul className="talk-list">
          {shown.map((x) => (
            <li key={x.id}>
              <button className="talk-row" onClick={() => setOpen(x)}>
                <b>{title(x)}</b>
                <span>{sub(x)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {talks && talks.length > 5 && !all && (
        <button className="btn small" onClick={() => setAll(true)}>
          {t("talkShowAll", { n: String(talks.length) })}
        </button>
      )}
      {drafts.length > 0 && (
        <>
          <h3 className="talk-head">{t("recoveryList", { n: String(RECOVERY_DAYS) })}</h3>
          <ul className="talk-list">
            {drafts.map((x) => (
              <li key={x.id}>
                <button className="talk-row draft" onClick={() => setOpen(x)}>
                  <b>{title(x)}</b>
                  <span>{sub(x)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {talks && talks.length + drafts.length > 0 && (
        <button
          className="btn small"
          onClick={() => {
            if (window.confirm(t("talkDeleteAllAsk"))) void clearTalks().then(refresh);
          }}
        >
          {t("talkDeleteAll")}
        </button>
      )}
      <p className="muted small">
        {t("savedStorageNote")}
        {native ? ` ${t("savedFilesNote")}` : ""}
      </p>
      {open && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label={title(open)}>
          <header className="sheet-head">
            <h2>
              {title(open)}
              <small className="talk-sub">{sub(open)}</small>
            </h2>
            <div className="sheet-actions">
              <button className="round-btn" aria-label={t("close")} onClick={() => setOpen(null)}>
                ×
              </button>
            </div>
          </header>
          <div className="sheet-body">
            {open.lines.map((l, i) => (
              <div key={i} className={`tline ${l.who}`} dir="auto">
                <span className="who">{l.who === "me" ? t("you") : l.name || t("talkThem")}</span>
                <p>{l.said || l.read}</p>
                {l.said && l.read && <p className="talk-other">{l.read}</p>}
              </div>
            ))}
          </div>
          <footer className="sheet-foot">
            <button className="btn primary small" onClick={() => void saveTranscript(talkText(open, { you: t("you"), them: t("talkThem"), title: kindName(open.kind) }), `simpatico-${stamp(open.startedAt)}.txt`)}>
              {t("talkSave")}
            </button>
            {open.draft && (
              <button
                className="btn small"
                onClick={() => {
                  void keepTalk(open.id).then(refresh);
                  setOpen(null);
                }}
              >
                {t("unsavedKeep")}
              </button>
            )}
            <button
              className="btn small danger"
              onClick={() => {
                void deleteTalk(open.id).then(refresh);
                setOpen(null);
              }}
            >
              {t("talkDelete")}
            </button>
          </footer>
        </div>
      )}
      </div>
    </details>
  );
}
