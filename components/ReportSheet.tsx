"use client";
import { useEffect, useRef, useState } from "react";
import { blockPerson, reportPerson } from "@/lib/blocks";
import { useT } from "@/lib/i18n";

const REASONS = ["harassment", "inappropriate", "spam", "other"] as const;
const REASON_KEY = { harassment: "reasonHarassment", inappropriate: "reasonInappropriate", spam: "reasonSpam", other: "reasonOther" } as const;

/**
 * "Report or block <name>": one tap to block, or pick a reason to report (which also blocks,
 * unless unticked). `room`/`seat`: where we are with them right now, when in a call.
 */
export function ReportSheet({ name, room, seat, onClose, onBlocked }: { name: string; room?: string; seat?: string; onClose: () => void; onBlocked?: () => void }) {
  const t = useT();
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [note, setNote] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => closeBtn.current?.focus(), []);

  const finish = (msg: string, blocked: boolean) => {
    setDone(msg);
    setBusy(false);
    setTimeout(() => (blocked && onBlocked ? onBlocked() : onClose()), 1400);
  };

  return (
    <div className="bsheet-backdrop" onClick={onClose}>
      <div className="bsheet report-sheet" role="dialog" aria-modal="true" aria-label={t("reportBlockTitle", { name })} onClick={(e) => e.stopPropagation()}>
        <div className="bsheet-handle" aria-hidden="true" />
        <button ref={closeBtn} className="round-btn bsheet-close" aria-label={t("close")} onClick={onClose}>
          ×
        </button>
        <h2>{t("reportBlockTitle", { name })}</h2>
        {done ? (
          <p className="report-done">{done}</p>
        ) : (
          <>
            <button
              className="btn big danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await blockPerson({ name, room, seat });
                finish(t("blockedDone", { name }), true);
              }}
            >
              {t("blockPerson", { name })}
            </button>
            <p className="small muted">{t("blockHint")}</p>

            <h3 className="report-or">{t("orReport")}</h3>
            <div className="chips report-reasons" role="radiogroup">
              {REASONS.map((r) => (
                <button key={r} role="radio" aria-checked={reason === r} className={`chip ${reason === r ? "on" : ""}`} onClick={() => setReason(r)}>
                  {t(REASON_KEY[r])}
                </button>
              ))}
            </div>
            {reason && (
              <>
                <textarea className="report-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("reportNote")} rows={2} maxLength={500} />
                <label className="clear-opt">
                  <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />
                  <span>{t("alsoBlock", { name })}</span>
                </label>
                <button
                  className="btn big secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await reportPerson({ name, reason, note, room, seat, block: alsoBlock });
                    finish(t("reportSent"), alsoBlock);
                  }}
                >
                  {t("sendReport")}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
