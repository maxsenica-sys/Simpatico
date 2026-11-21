"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { applyMove, exportAll, parseMove } from "@/lib/move";
import { canShareLink } from "@/lib/native";

/**
 * Me page: move everything to a new Home Screen icon (same phone) or another phone.
 * Old one: "Copy everything". New one: "Paste my data", and everything is in.
 */
/** `arriving`: opened from the home screen's "Bring your data" on a new phone, so pasting comes first. */
export function MoveSection({ arriving = false }: { arriving?: boolean }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [bad, setBad] = useState(false);
  const [manual, setManual] = useState(false);
  const [text, setText] = useState("");
  const ref = useRef<HTMLElement>(null);

  // Arriving from the home screen's "Bring your data" link: show this section.
  useEffect(() => {
    if (location.hash === "#move") ref.current?.scrollIntoView({ block: "center" });
  }, []);

  const copy = async () => {
    const code = exportAll();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setManual(true);
      setText(code);
    }
  };
  const send = async () => {
    try {
      await navigator.share({ text: exportAll() });
    } catch {}
  };
  // Straight in: no preview step. Then home, where their name, photo and Recent are waiting.
  const check = (raw: string) => {
    const d = parseMove(raw);
    setBad(!d);
    if (!d) return;
    applyMove(d);
    location.assign("/");
  };
  const paste = async () => {
    try {
      check(await navigator.clipboard.readText());
    } catch {
      setManual(true);
    }
  };

  const send_ = (
    <>
      <h2>{t("moveTitle")}</h2>
      <p className="muted small">{t("moveHint")}</p>
      <div className="move-row">
        <button className={`btn small ${arriving ? "" : "primary"}`} onClick={() => void copy()}>
          {t("moveCopy")}
        </button>
        {canShareLink() && (
          <button className="btn small" onClick={() => void send()}>
            {t("moveShare")}
          </button>
        )}
      </div>
      {copied && <p className="small move-ok">{t("moveCopied")}</p>}
    </>
  );
  const receive = (
    <>
      {arriving ? <h2>{t("movePasteTitle")}</h2> : <h3 className="move-sub">{t("movePasteTitle")}</h3>}
      <p className="muted small">{t("movePasteHint")}</p>
      <div className="move-row">
        <button className={`btn small ${arriving ? "primary" : ""}`} onClick={() => void paste()}>
          {t("movePaste")}
        </button>
      </div>
      {manual && (
        <div className="move-manual">
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("movePasteBox")} rows={3} spellCheck={false} />
          <button className="btn small" onClick={() => check(text)} disabled={!text.trim()}>
            {t("moveCheck")}
          </button>
        </div>
      )}
      {bad && <p className="small move-bad">{t("moveBad")}</p>}
    </>
  );
  // On the new phone, only pasting is shown; copying is for the old phone.
  return (
    <section className="pcard move" ref={ref} id="move">
      {arriving ? receive : send_}
      {!arriving && receive}
    </section>
  );
}
