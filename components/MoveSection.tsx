"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { applyMove, exportAll, parseMove, summarise, type MoveData } from "@/lib/move";
import { canShareLink } from "@/lib/native";

/**
 * Me page: move everything to a new Home Screen icon (same phone) or another phone.
 * Old one: "Copy everything". New one: "Paste my data" -> check what was found -> "Bring it here".
 */
export function MoveSection() {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [found, setFound] = useState<MoveData | null>(null);
  const [bad, setBad] = useState(false);
  const [manual, setManual] = useState(false);
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
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
  const check = (raw: string) => {
    const d = parseMove(raw);
    setFound(d);
    setBad(!d);
  };
  const paste = async () => {
    try {
      check(await navigator.clipboard.readText());
    } catch {
      setManual(true);
    }
  };

  if (done)
    return (
      <section className="pcard move" ref={ref}>
        <h2>{t("moveTitle")}</h2>
        <p className="small move-ok">{t("moveDone")}</p>
        <button className="btn small primary" onClick={() => location.reload()}>
          {t("moveSee")}
        </button>
      </section>
    );

  const sum = found ? summarise(found) : null;
  return (
    <section className="pcard move" ref={ref} id="move">
      <h2>{t("moveTitle")}</h2>
      <p className="muted small">{t("moveHint")}</p>

      <div className="move-row">
        <button className="btn small primary" onClick={() => void copy()}>
          {t("moveCopy")}
        </button>
        {canShareLink() && (
          <button className="btn small" onClick={() => void send()}>
            {t("moveShare")}
          </button>
        )}
      </div>
      {copied && <p className="small move-ok">{t("moveCopied")}</p>}

      <h3 className="move-sub">{t("movePasteTitle")}</h3>
      <p className="muted small">{t("movePasteHint")}</p>
      {!sum && (
        <div className="move-row">
          <button className="btn small" onClick={() => void paste()}>
            {t("movePaste")}
          </button>
        </div>
      )}
      {manual && !sum && (
        <div className="move-manual">
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t("movePasteBox")} rows={3} spellCheck={false} />
          <button className="btn small" onClick={() => check(text)} disabled={!text.trim()}>
            {t("moveCheck")}
          </button>
        </div>
      )}
      {bad && <p className="small move-bad">{t("moveBad")}</p>}
      {sum && (
        <div className="move-found">
          <p className="small">
            {t("movePreview", { name: sum.name || "?", people: String(sum.people), words: String(sum.words) })}
            {sum.photo ? ` · ${t("movePhoto")}` : ""}
            {sum.card ? ` · ${t("moveCard")}` : ""}
          </p>
          <p className="small muted">{t("moveReplaces")}</p>
          <div className="move-row">
            <button
              className="btn small primary"
              onClick={() => {
                applyMove(found!);
                setDone(true);
              }}
            >
              {t("moveApply")}
            </button>
            <button
              className="btn small"
              onClick={() => {
                setFound(null);
                setText("");
              }}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
