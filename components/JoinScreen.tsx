"use client";
import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n";
import { LanguageLine } from "./LanguageLine";
import { Logo } from "./Logo";
import { ShareLink } from "./ShareLink";

export function JoinScreen({
  stream,
  shareUrl,
  onJoin,
}: {
  stream: MediaStream | null;
  shareUrl: string | null;
  onJoin: (audioOnly: boolean) => void;
}) {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (video.current && stream) {
      video.current.srcObject = stream;
      video.current.play().catch(() => {});
    }
  }, [stream]);
  const hasVideo = !!stream?.getVideoTracks().length;

  return (
    <main className="screen join">
      <header className="join-head">
        <Logo small />
      </header>
      <div className="preview">
        {hasVideo ? <video ref={video} className="mirror" autoPlay playsInline muted /> : <div className="preview-empty">{stream ? "" : t("cameraStarting")}</div>}
      </div>
      <section className="join-panel">
        <LanguageLine />
        {hasVideo ? (
          <>
            <button className="btn primary big" disabled={!stream} onClick={() => onJoin(false)}>
              {t("joinVideo")}
            </button>
            <button className="btn big secondary" disabled={!stream} onClick={() => onJoin(true)}>
              {t("joinAudio")}
            </button>
            <p className="muted small">{t("audioOnlyHint")}</p>
          </>
        ) : (
          <button className="btn primary big" disabled={!stream} onClick={() => onJoin(true)}>
            {t("join")}
          </button>
        )}
        <p className="muted small">{t("permissionNote")}</p>
        {shareUrl && <ShareLink url={shareUrl} />}
      </section>
    </main>
  );
}
