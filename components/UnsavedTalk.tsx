"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { deleteTalk, keepTalk, listDrafts, type SavedTalk } from "@/lib/saved";

/**
 * Home screen: a conversation that closed before the person could choose (battery, crash, the
 * app swiped away, leaving In person by the back gesture) is still on the phone. Offer it once
 * here: keep it, or delete it.
 */
export function UnsavedTalk() {
  const t = useT();
  const [talk, setTalk] = useState<SavedTalk | null>(null);
  const [kept, setKept] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let live = true;
    // "Open" and quiet for a few seconds: it is not a conversation still going in another tab.
    // Reopened sooner than that (a quick relaunch after a crash): look again in a moment.
    const QUIET = 6000;
    const look = () =>
      void listDrafts().then((d) => {
        if (!live) return;
        const open = d.filter((x) => x.open);
        const ready = open.find((x) => Date.now() - x.endedAt > QUIET);
        if (ready) return setTalk(ready);
        if (open.length) timer = setTimeout(look, QUIET - (Date.now() - open[0].endedAt) + 300);
      });
    look();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, []);
  if (!talk) return null;
  const when = new Date(talk.startedAt).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <section className="unsaved" role="status">
      <b>{kept ? t("talkKept") : t("unsavedTitle")}</b>
      <span>
        {when} · {t("talkLines", { n: String(talk.lines.length) })}
        {kept ? "" : `. ${t("unsavedSub")}`}
      </span>
      {!kept && (
        <div className="unsaved-actions">
          <button
            className="btn small primary"
            onClick={() => {
              // Say "kept" only once it is truly written.
              void keepTalk(talk.id).then((ok) => ok && setKept(true));
            }}
          >
            {t("unsavedKeep")}
          </button>
          <button
            className="btn small"
            onClick={() => {
              void deleteTalk(talk.id);
              setTalk(null);
            }}
          >
            {t("talkDelete")}
          </button>
        </div>
      )}
    </section>
  );
}
