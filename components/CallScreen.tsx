"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { CallController, CallState } from "@/lib/call";
import { useT } from "@/lib/i18n";
import { Captions } from "./Captions";
import { Notice } from "./Notice";
import { ShareLink } from "./ShareLink";
import { Transcript } from "./Transcript";

const OWN_LINE_MS = 5000;
const NO_VIDEO_GRACE_MS = 4000;

export function CallScreen({ call, shareUrl, onRejoin }: { call: CallController; shareUrl: string; onRejoin: () => void }) {
  const t = useT();
  const s = useSyncExternalStore(call.subscribe, call.getState, call.getState);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const selfRef = useRef<HTMLVideoElement>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [selfView, setSelfView] = useState(true);
  const [controls, setControls] = useState(true);
  const [transcript, setTranscript] = useState(false);
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const [now, setNow] = useState(() => Date.now());
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [videoLostAt, setVideoLostAt] = useState<number | null>(null);
  const [firstOwnAt, setFirstOwnAt] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Remote audio + video both play through this one element, so it is never unmounted or display:none.
  useEffect(() => {
    const v = remoteRef.current;
    if (!v) return;
    v.srcObject = s.remoteStream;
    if (s.remoteStream) v.play().then(() => setNeedsTap(false), () => setNeedsTap(true));
  }, [s.remoteStream]);

  useEffect(() => {
    const v = selfRef.current;
    if (v && v.srcObject !== s.selfVideo) {
      v.srcObject = s.selfVideo;
      v.play().catch(() => {});
    }
  }, [s.selfVideo, selfView, s.camOn, s.phase]);

  useEffect(() => {
    if (s.phase === "connected") setConnectedAt((c) => c ?? Date.now());
    else setConnectedAt(null);
  }, [s.phase]);

  useEffect(() => {
    setVideoLostAt(s.remoteVideoOk ? null : (v) => v ?? Date.now());
  }, [s.remoteVideoOk]);

  useEffect(() => {
    if (s.ownLine && firstOwnAt === null) setFirstOwnAt(Date.now());
  }, [s.ownLine, firstOwnAt]);

  const poke = () => {
    setControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), 5000);
  };
  useEffect(() => {
    if (s.phase === "connected") poke();
    else setControls(true);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [s.phase]);

  // Portrait video on a landscape screen (or the reverse) is shown whole instead of cropped.
  const updateFit = () => {
    const v = remoteRef.current;
    if (!v || !v.videoWidth) return;
    const videoLandscape = v.videoWidth >= v.videoHeight;
    const screenLandscape = window.innerWidth >= window.innerHeight;
    setFit(videoLandscape === screenLandscape ? "cover" : "contain");
  };
  useEffect(() => {
    window.addEventListener("resize", updateFit);
    return () => window.removeEventListener("resize", updateFit);
  }, []);

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

  const connected = s.phase === "connected";
  const status =
    s.phase === "waiting" ? (s.peerLeft ? t("peerLeft") : t("waiting"))
    : s.phase === "joining" || s.phase === "connecting" ? (s.reconnecting ? t("reconnecting") : t("connecting"))
    : null;

  // What to show instead of their video, if anything.
  const settled = connectedAt !== null && now - connectedAt > NO_VIDEO_GRACE_MS;
  const placeholder: string | null = !connected
    ? null
    : s.audioOnly || s.partnerAudioOnly
      ? t("youAreAudioOnly")
      : s.remoteCam === false
        ? t("theirCameraOff")
        : settled && !s.remoteVideoOk && videoLostAt !== null && now - videoLostAt > NO_VIDEO_GRACE_MS
          ? t("videoNotArriving")
          : null;

  const ccState = worst(s.captionStatus, s.myCaptionStatus);
  const showOwn = connected && s.ownLine && now - s.ownLine.at < OWN_LINE_MS;
  const showOwnHint = showOwn && firstOwnAt !== null && now - firstOwnAt < 8000;

  const banners: { key: string; text: string; tone: "warn" | "info"; actions?: ReactNode }[] = [];
  if (connected) {
    for (const p of s.problems) {
      if (p === "weak-network")
        banners.push({
          key: p,
          tone: "warn",
          text: t("weakNetwork"),
          actions: (
            <>
              <button className="btn small primary" onClick={() => call.setAudioOnly(true)}>
                {t("goAudioOnly")}
              </button>
              <button className="btn small" onClick={() => call.dismissProblem("weak-network")}>
                {t("notNow")}
              </button>
            </>
          ),
        });
      if (p === "they-cant-see-you")
        banners.push({
          key: p,
          tone: "warn",
          text: t("theyCantSeeYou"),
          actions: (
            <button className="btn small primary" onClick={() => call.fixVideo()}>
              {t("fixVideo")}
            </button>
          ),
        });
      if (p === "they-cant-hear-you") banners.push({ key: p, tone: "warn", text: t("theyCantHearYou") });
      if (p === "camera-failed")
        banners.push({
          key: p,
          tone: "warn",
          text: t("cameraFailed"),
          actions: (
            <>
              <button className="btn small primary" onClick={() => call.setCamera(true)}>
                {t("retry")}
              </button>
              <button className="btn small" onClick={() => call.dismissProblem("camera-failed")}>
                {t("notNow")}
              </button>
            </>
          ),
        });
    }
    if (s.partnerAudioOnly && s.camOn) banners.push({ key: "partner-audio", tone: "info", text: t("theyAreAudioOnly") });
    if (ccState !== "ok")
      banners.push({ key: "cc", tone: "warn", text: ccState === "paused" ? t("captionsPaused") : t("captionsUnavailable") });
    if (s.muted) banners.push({ key: "muted", tone: "info", text: t("muted") });
  }
  const showControls = controls || !connected || banners.some((b) => b.tone === "warn");

  return (
    <main className={`call ${showControls ? "show-controls" : ""}`} onClick={poke} onMouseMove={poke}>
      <video
        ref={remoteRef}
        className={`remote ${placeholder ? "hidden-video" : ""}`}
        style={{ objectFit: fit }}
        autoPlay
        playsInline
        onLoadedMetadata={updateFit}
        onResize={updateFit}
      />

      {placeholder && (
        <div className="no-video">
          <div className="no-video-icon" aria-hidden="true">
            {s.audioOnly || s.partnerAudioOnly ? <AudioOnlyIcon size={44} /> : <CameraIcon off size={44} />}
          </div>
          <p>{placeholder}</p>
        </div>
      )}

      {status && (
        <div className="call-status">
          <div className="spinner" aria-hidden="true" />
          <p>{status}</p>
          {s.phase === "waiting" && <ShareLink url={shareUrl} />}
        </div>
      )}

      {s.phase === "failed" && (
        <div className="call-status" onClick={(e) => e.stopPropagation()}>
          <h2>{t("cantConnect")}</h2>
          <p className="muted">{t("cantConnectHint")}</p>
          <button className="btn primary" onClick={() => call.retry()}>
            {t("retry")}
          </button>
          {!s.audioOnly && (
            <button
              className="btn"
              onClick={async () => {
                await call.setAudioOnly(true);
                call.retry();
              }}
            >
              {t("tryAudioOnly")}
            </button>
          )}
          <ShareLink url={shareUrl} compact />
        </div>
      )}

      {needsTap && connected && (
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

      <div className="top-stack">
      <div className="topbar" onClick={(e) => e.stopPropagation()}>
        <button className={`cc-pill ${ccState}`} onClick={() => setTranscript(true)} aria-label={t("showTranscript")}>
          <span className="dot" />
          {ccState === "ok" ? t("captionsOn") : ccState === "paused" ? t("captionsPaused") : t("captionsUnavailable")}
        </button>
        <div className="controls">
          <Ctrl label={t("lblMic")} title={s.muted ? t("unmute") : t("mute")} danger={s.muted} active={s.meSpeaking && !s.muted} onClick={() => call.setMuted(!s.muted)}>
            <MicIcon off={s.muted} />
          </Ctrl>
          {!s.audioOnly && (
            <Ctrl label={t("lblCamera")} title={s.camOn ? t("cameraOff") : t("cameraOn")} danger={!s.camOn} onClick={() => call.setCamera(!s.camOn)}>
              <CameraIcon off={!s.camOn} />
            </Ctrl>
          )}
          {s.camOn && s.canSwitchCamera && (
            <Ctrl label={t("lblFlip")} title={t("switchCamera")} onClick={() => call.switchCamera()}>
              <FlipIcon />
            </Ctrl>
          )}
          <Ctrl
            label={s.audioOnly ? t("lblVideo") : t("lblAudioOnly")}
            title={s.audioOnly ? t("goVideo") : t("goAudioOnly")}
            onClick={() => call.setAudioOnly(!s.audioOnly)}
          >
            {s.audioOnly ? <CameraIcon off={false} /> : <AudioOnlyIcon />}
          </Ctrl>
          <Ctrl label={t("lblText")} title={t("showTranscript")} onClick={() => setTranscript(true)}>
            <TextIcon />
          </Ctrl>
          <Ctrl label={t("lblEnd")} title={t("endCall")} danger onClick={() => call.leave()}>
            <HangupIcon />
          </Ctrl>
        </div>
      </div>

      {(banners.length > 0 || showOwn) && (
        <div className="banners" onClick={(e) => e.stopPropagation()}>
          {banners.map((b) => (
            <div key={b.key} className={`banner ${b.tone}`}>
              <p>{b.text}</p>
              {b.actions && <div className="banner-actions">{b.actions}</div>}
            </div>
          ))}
          {showOwn && (
            <div className="own-line" dir="auto">
              <span className="who">{t("you")}</span> {s.ownLine!.text}
              {showOwnHint && <div className="own-hint">{t("captionsCheck")}</div>}
            </div>
          )}
        </div>
      )}
      </div>

      {selfView && s.camOn && s.selfVideo && (
        <div className="self" onClick={(e) => e.stopPropagation()}>
          <video ref={selfRef} className={facingMirror(s)} autoPlay playsInline muted />
          <button className="self-x" aria-label={t("hideSelf")} onClick={() => setSelfView(false)}>
            ×
          </button>
        </div>
      )}
      {!selfView && s.camOn && (
        <button
          className="self-restore"
          aria-label={t("showSelf")}
          onClick={(e) => {
            e.stopPropagation();
            setSelfView(true);
          }}
        >
          <CameraIcon off={false} size={18} />
        </button>
      )}

      <Captions captions={s.captions} speaking={connected && s.partnerSpeaking} onOpen={() => setTranscript(true)} />

      {transcript && <Transcript lines={s.transcript} onClose={() => setTranscript(false)} />}
    </main>
  );
}

function worst(a: CallState["captionStatus"], b: CallState["captionStatus"]) {
  const rank = { ok: 0, paused: 1, unavailable: 2 } as const;
  return rank[a] >= rank[b] ? a : b;
}

/** Mirror the front camera only, like a mirror; the back camera shows the world as it is. */
function facingMirror(s: CallState) {
  const settings = s.selfVideo?.getVideoTracks()[0]?.getSettings();
  return settings?.facingMode === "environment" ? "" : "mirror";
}

function Ctrl({
  label,
  title,
  danger,
  active,
  onClick,
  children,
}: {
  label: string;
  title: string;
  danger?: boolean;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button className={`ctrl ${danger ? "danger" : ""} ${active ? "active" : ""}`} aria-label={title} title={title} onClick={onClick}>
      <span className="round">{children}</span>
      <span className="ctrl-label">{label}</span>
    </button>
  );
}

const svg = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function MicIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...svg} aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}
function CameraIcon({ off, size = 22 }: { off: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...svg} aria-hidden="true">
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}
function FlipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...svg} aria-hidden="true">
      <path d="M4 7h11a5 5 0 0 1 5 5M20 17H9a5 5 0 0 1-5-5" />
      <path d="M16 4l3 3-3 3M8 20l-3-3 3-3" />
    </svg>
  );
}
function AudioOnlyIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...svg} aria-hidden="true">
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="14" width="4" height="6" rx="1.5" />
      <rect x="17" y="14" width="4" height="6" rx="1.5" />
    </svg>
  );
}
function TextIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...svg} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M7 10h4M13 10h4M7 14h10" />
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
