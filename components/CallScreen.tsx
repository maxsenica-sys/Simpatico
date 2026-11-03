"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CallController } from "@/lib/call";
import { useT } from "@/lib/i18n";
import { Captions } from "./Captions";
import { Notice } from "./Notice";
import { ShareLink } from "./ShareLink";
import { Transcript } from "./Transcript";

export function CallScreen({ call, local, shareUrl, onRejoin }: { call: CallController; local: MediaStream; shareUrl: string; onRejoin: () => void }) {
  const t = useT();
  const s = useSyncExternalStore(call.subscribe, call.getState, call.getState);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const localRef = useRef<HTMLVideoElement>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [selfView, setSelfView] = useState(true);
  const [controls, setControls] = useState(true);
  const [transcript, setTranscript] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const v = remoteRef.current;
    if (!v) return;
    v.srcObject = s.remoteStream;
    if (s.remoteStream) v.play().then(() => setNeedsTap(false), () => setNeedsTap(true));
  }, [s.remoteStream]);

  useEffect(() => {
    if (localRef.current && localRef.current.srcObject !== local) {
      localRef.current.srcObject = local;
      localRef.current.play().catch(() => {});
    }
  }, [local, selfView, s.phase]);

  const poke = () => {
    setControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), 4000);
  };
  useEffect(() => {
    if (s.phase === "connected") poke();
    else setControls(true);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [s.phase]);

  if (s.phase === "ended")
    return (
      <Notice title={t("callEnded")}>
        <button className="btn primary" onClick={onRejoin}>
          {t("rejoin")}
        </button>
        <Link className="btn" href="/">
          {t("startNew")}
        </Link>
      </Notice>
    );
  if (s.phase === "gone" || s.phase === "full" || s.phase === "replaced")
    return (
      <Notice title={s.phase === "gone" ? t("roomGone") : s.phase === "full" ? t("roomFull") : t("replaced")}>
        <Link className="btn primary" href="/">
          {t("startNew")}
        </Link>
      </Notice>
    );

  const hasLocalVideo = local.getVideoTracks().length > 0;
  const status =
    s.phase === "waiting" ? (s.peerLeft ? t("peerLeft") : t("waiting"))
    : s.phase === "joining" || s.phase === "connecting" ? (s.reconnecting ? t("reconnecting") : t("connecting"))
    : null;

  return (
    <main className={`call ${controls ? "show-controls" : ""}`} onClick={poke}>
      <video ref={remoteRef} className="remote" autoPlay playsInline />

      {status && (
        <div className="call-status">
          <div className="spinner" aria-hidden="true" />
          <p>{status}</p>
          {s.phase === "waiting" && <ShareLink url={shareUrl} />}
        </div>
      )}

      {s.phase === "failed" && (
        <div className="call-status">
          <h2>{t("cantConnect")}</h2>
          <p className="muted">{t("cantConnectHint")}</p>
          <button
            className="btn primary"
            onClick={(e) => {
              e.stopPropagation();
              call.retry();
            }}
          >
            {t("retry")}
          </button>
        </div>
      )}

      {needsTap && s.phase === "connected" && (
        <button
          className="tap-sound"
          onClick={(e) => {
            e.stopPropagation();
            remoteRef.current?.play().then(() => setNeedsTap(false), () => {});
          }}
        >
          {t("tapForSound")}
        </button>
      )}

      <div className="topbar">
        <button
          className={`round ${s.muted ? "danger" : ""}`}
          aria-label={s.muted ? t("unmute") : t("mute")}
          title={s.muted ? t("unmute") : t("mute")}
          onClick={(e) => {
            e.stopPropagation();
            call.setMuted(!s.muted);
          }}
        >
          <MicIcon off={s.muted} />
        </button>
        {!selfView && hasLocalVideo && (
          <button
            className="round"
            aria-label={t("showSelf")}
            title={t("showSelf")}
            onClick={(e) => {
              e.stopPropagation();
              setSelfView(true);
            }}
          >
            <SelfIcon />
          </button>
        )}
        <button
          className="round danger"
          aria-label={t("endCall")}
          title={t("endCall")}
          onClick={(e) => {
            e.stopPropagation();
            call.leave();
          }}
        >
          <HangupIcon />
        </button>
      </div>

      {(s.captionStatus !== "ok" || s.muted) && s.phase === "connected" && (
        <div className="chip">{s.muted ? t("muted") : s.captionStatus === "paused" ? t("captionsPaused") : t("captionsUnavailable")}</div>
      )}

      {selfView && hasLocalVideo && (
        <div className="self">
          <video ref={localRef} className="mirror" autoPlay playsInline muted />
          <button
            className="self-x"
            aria-label={t("hideSelf")}
            onClick={(e) => {
              e.stopPropagation();
              setSelfView(false);
            }}
          >
            ×
          </button>
        </div>
      )}

      <Captions
        captions={s.captions}
        onOpen={() => {
          setTranscript(true);
        }}
      />

      {transcript && <Transcript lines={s.transcript} onClose={() => setTranscript(false)} />}
    </main>
  );
}

function MicIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}
function HangupIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M12 9c-3.2 0-6.2.9-8.6 2.6-.6.4-.8 1.2-.5 1.9l1.1 2.1c.3.6 1 .9 1.7.7l3-1c.5-.2.9-.7.9-1.3v-1.6a12 12 0 0 1 4.8 0V14c0 .6.4 1.1.9 1.3l3 1c.7.2 1.4-.1 1.7-.7l1.1-2.1c.3-.7.1-1.5-.5-1.9A15 15 0 0 0 12 9z" />
    </svg>
  );
}
function SelfIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3" />
    </svg>
  );
}
