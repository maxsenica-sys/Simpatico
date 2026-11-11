"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { worst, type CallController, type CallState, type Participant } from "@/lib/call";
import { CAPTION_SIZES, loadCaptionPrefs, saveCaptionPrefs, type CaptionPrefs } from "@/lib/captionPrefs";
import { saveTranscript, transcriptText } from "@/lib/transcriptFile";
import { langInfo } from "@/shared/lang";
import { useT } from "@/lib/i18n";
import { BRAND } from "@/shared/brand";
import { Captions } from "./Captions";
import { LogoMark } from "./Logo";
import { Notice } from "./Notice";
import { SelfView, type SelfMode } from "./SelfView";
import { ShareLink } from "./ShareLink";
import { Transcript } from "./Transcript";
import { noteCall, noteTime } from "@/lib/recent";

const OWN_LINE_MS = 5000;
const NO_VIDEO_GRACE_MS = 4000;

export function CallScreen({ call, shareUrl, onRejoin }: { call: CallController; shareUrl: string; onRejoin: () => void }) {
  const t = useT();
  const s = useSyncExternalStore(call.subscribe, call.getState, call.getState);
  // Someone joined (first connection) or left: chime, buzz, and say so in the tab title when
  // the page is in the background, so a phone left on the table tells you the call started.
  const announced = useRef(new Set<string>());
  useEffect(() => {
    const ids = new Set(s.participants.map((p) => p.id));
    for (const p of s.participants) {
      if (!p.connected || announced.current.has(p.id)) continue;
      announced.current.add(p.id);
      call.chime("join");
      if (document.visibilityState !== "visible") document.title = `● ${t("joinedTitle", { name: p.name || "?" })}`;
    }
    for (const id of [...announced.current]) {
      if (ids.has(id)) continue;
      announced.current.delete(id);
      call.chime("leave");
    }
  }, [s.participants, call, t]);
  useEffect(() => {
    const restore = () => document.visibilityState === "visible" && (document.title = BRAND.appName);
    document.addEventListener("visibilitychange", restore);
    return () => document.removeEventListener("visibilitychange", restore);
  }, []);
  const stageRef = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [selfView, setSelfView] = useState(true);
  const [selfMode, setSelfMode] = useState<SelfMode>("small");
  const [transcript, setTranscript] = useState(false);
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const [now, setNow] = useState(() => Date.now());
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const router = useRouter();

  // "Recent" on the home screen: remember who we actually talked to, and for how long.
  const met = useRef(new Map<string, string>());
  const timed = useRef(false);
  const latest = useRef(s);
  latest.current = s;
  useEffect(() => {
    for (const p of s.participants)
      if (p.connected && !met.current.has(p.id)) {
        met.current.set(p.id, p.name);
        noteCall(p.name, p.lang.speaks);
      }
  }, [s.participants]);
  useEffect(() => {
    const finish = () => {
      const st = latest.current;
      if (timed.current || !st.startedAt || !met.current.size) return;
      timed.current = true;
      noteTime([...met.current.values()], ((st.endedAt ?? Date.now()) - st.startedAt) / 1000);
    };
    if (s.phase === "ended") finish();
    window.addEventListener("pagehide", finish);
    return () => window.removeEventListener("pagehide", finish);
  }, [s.phase]);
  useEffect(
    () => () => {
      const st = latest.current;
      if (!timed.current && st.startedAt && met.current.size) noteTime([...met.current.values()], (Date.now() - st.startedAt) / 1000);
    },
    [],
  );
  const [videoLostAt, setVideoLostAt] = useState<number | null>(null);
  const [firstOwnAt, setFirstOwnAt] = useState<number | null>(null);
  const [prefs, setPrefs] = useState<CaptionPrefs>({ size: "m", box: false, style: "instant", focus: true });
  const [invite, setInvite] = useState(false);
  const [wide, setWide] = useState(false);

  const group = s.kind === "group";
  useEffect(() => {
    setPrefs(loadCaptionPrefs());
    setWide(window.matchMedia?.("(min-width: 760px)").matches ?? false);
  }, []);
  const changePrefs = (p: CaptionPrefs) => {
    setPrefs(p);
    saveCaptionPrefs(p);
    call.setCaptionStyle(p.style);
    call.setVoiceFocus(p.focus);
  };
  const save = () => {
    const names = { ...s.names };
    const text = transcriptText(s.transcript, names, t("you"), t("transcriptTitle"));
    saveTranscript(text, `transcript-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.txt`);
  };

  // Keyboard shortcuts (laptops): M mute, V camera, T transcript, Esc close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || el?.closest("input, textarea, select")) return;
      const k = e.key.toLowerCase();
      if (k === "escape") {
        setTranscript(false);
        setInvite(false);
      } else if (k === "m") call.setMuted(!call.getState().muted);
      else if (k === "v" && !call.getState().audioOnly) call.setCamera(!call.getState().camOn);
      else if (k === "t") setTranscript((v) => !v);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [call]);
  const stage: Participant | undefined = s.participants.find((p) => p.id === s.activeId) ?? s.participants[0];

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // The stage only shows video; each person's audio plays through their own <audio> below.
  useEffect(() => {
    const v = stageRef.current;
    if (!v) return;
    const stream = stage?.stream ?? null;
    if (v.srcObject !== stream) {
      v.srcObject = stream;
      if (stream) v.play().catch(() => {});
    }
  }, [stage?.stream]);


  useEffect(() => {
    if (s.phase === "connected") setConnectedAt((c) => c ?? Date.now());
    else setConnectedAt(null);
  }, [s.phase]);

  const stageVideoOk = !!stage?.videoOk;
  useEffect(() => {
    setVideoLostAt(stageVideoOk ? null : (v) => v ?? Date.now());
  }, [stageVideoOk, stage?.id]);

  useEffect(() => {
    if (s.ownLine && firstOwnAt === null) setFirstOwnAt(Date.now());
  }, [s.ownLine, firstOwnAt]);


  // Portrait video on a landscape screen (or the reverse) is shown whole instead of cropped.
  const updateFit = () => {
    const v = stageRef.current;
    if (!v || !v.videoWidth) return;
    const videoLandscape = v.videoWidth >= v.videoHeight;
    const screenLandscape = window.innerWidth >= window.innerHeight;
    setFit(videoLandscape === screenLandscape ? "cover" : "contain");
  };
  useEffect(() => {
    window.addEventListener("resize", updateFit);
    return () => window.removeEventListener("resize", updateFit);
  }, []);

  const onAudioBlocked = (id: string, isBlocked: boolean) =>
    setBlocked((prev) => {
      if (prev.has(id) === isBlocked) return prev;
      const next = new Set(prev);
      if (isBlocked) next.add(id);
      else next.delete(id);
      return next;
    });

  if (s.phase === "ended") return <EndScreen call={call} s={s} onSave={save} onRejoin={onRejoin} />;
  if (s.phase === "gone" || s.phase === "full" || s.phase === "replaced")
    return (
      <Notice title={s.phase === "gone" ? t("roomGone") : s.phase === "full" ? (group ? t("groupFull") : t("roomFull")) : t("replaced")}>
        <Link className="btn primary" href="/">
          {t("startNew")}
        </Link>
      </Notice>
    );

  const connected = s.phase === "connected";
  // Nobody has answered yet (e.g. a call started by accident): ending just goes back home.
  const neverConnected = connectedAt === null;
  const goHome = () => {
    call.cancel();
    router.push("/");
  };
  const status =
    s.phase === "waiting"
      ? s.peerLeft
        ? t("leftCall", { name: s.peerLeft })
        : group
          ? t("waitingGroup")
          : t("waiting")
      : s.phase === "joining" || s.phase === "connecting"
        ? s.reconnecting
          ? t("reconnecting")
          : t("connecting")
        : null;

  // What to show instead of the stage video, if anything.
  const settled = connectedAt !== null && now - connectedAt > NO_VIDEO_GRACE_MS;
  const stageAudioOnly = s.audioOnly || !!stage?.partnerAudioOnly;
  const placeholder: string | null =
    !connected || !stage
      ? null
      : group && !stageAudioOnly
        ? stage.videoOk
          ? null
          : "" // group: their avatar and name until their video is actually arriving
        : stageAudioOnly
        ? t("youAreAudioOnly")
        : stage.remoteCam === false
          ? group
            ? ""
            : t("theirCameraOff")
          : settled && !stage.videoOk && videoLostAt !== null && now - videoLostAt > NO_VIDEO_GRACE_MS
            ? group
              ? ""
              : t("videoNotArriving")
            : null;

  const ccState = worst([s.captionStatus, s.myCaptionStatus]);
  const showOwn = connected && s.ownLine && now - s.ownLine.at < OWN_LINE_MS;
  const showOwnHint = showOwn && firstOwnAt !== null && now - firstOwnAt < 8000;
  const names = Object.fromEntries(s.participants.map((p) => [p.id, p.name]));
  const anySpeaking = s.participants.some((p) => p.speaking);

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
    for (const p of s.participants.filter((x) => x.failed))
      banners.push({
        key: `failed-${p.id}`,
        tone: "warn",
        text: t("couldntReach", { name: p.name }),
        actions: (
          <button className="btn small primary" onClick={() => call.retry()}>
            {t("retry")}
          </button>
        ),
      });
    if (!group && stage?.partnerAudioOnly && s.camOn) banners.push({ key: "partner-audio", tone: "info", text: t("theyAreAudioOnly") });
    for (const p of s.participants) if (p.away) banners.push({ key: `away-${p.id}`, tone: "info", text: t("isAway", { name: p.name }) });
    if (ccState !== "ok")
      banners.push({ key: "cc", tone: "warn", text: ccState === "paused" ? t("captionsPaused") : t("captionsUnavailable") });
    if (s.muted) banners.push({ key: "muted", tone: "info", text: t("muted") });
  }

  return (
    <main
      className={`call ${group ? "group" : ""} ${prefs.box ? "cap-box" : ""} ${selfView && s.camOn && s.selfVideo && selfMode === "split" ? "split" : ""}`}
      style={{ ["--cap-size" as string]: CAPTION_SIZES[prefs.size] }}
    >
      <video
        ref={stageRef}
        className={`remote ${placeholder !== null ? "hidden-video" : ""}`}
        style={{ objectFit: fit }}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={updateFit}
        onResize={updateFit}
      />
      {s.participants.map((p) => (
        <RemoteAudio key={p.id} stream={p.stream} muted={!call.audible(p)} onBlocked={(b) => onAudioBlocked(p.id, b)} />
      ))}

      {placeholder !== null && stage && (
        <div className="no-video">
          {group ? (
            <div className={`avatar big ${stage.speaking ? "speaking" : ""}`} aria-hidden="true">
              {initials(stage.name)}
            </div>
          ) : (
            <div className="no-video-icon" aria-hidden="true">
              {stageAudioOnly ? <AudioOnlyIcon size={44} /> : <CameraIcon off size={44} />}
            </div>
          )}
          {stage.name && <p className="stage-name">{stage.name}</p>}
          {placeholder && <p>{placeholder}</p>}
        </div>
      )}
      {connected && stage?.name && placeholder === null && <div className="stage-label">{stage.name}</div>}

      {status && (
        <div className="call-status">
          <div className="spinner" aria-hidden="true" />
          <p>{status}</p>
          {s.phase === "waiting" && <ShareLink url={shareUrl} qr={group || wide} />}
          {s.phase === "waiting" && neverConnected && (
            <button className="btn secondary cancel-wait" onClick={goHome}>
              {t("cancelCall")}
            </button>
          )}
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

      {blocked.size > 0 && connected && (
        <button
          className="tap-sound"
          onClick={(e) => {
            e.stopPropagation();
            document.querySelectorAll<HTMLAudioElement>("audio.remote-audio").forEach((a) => a.play().catch(() => {}));
            setBlocked(new Set());
          }}
        >
          {t("tapForSound")}
        </button>
      )}

      <div className="top-stack">
        <div className="topbar" onClick={(e) => e.stopPropagation()}>
          <div className="pills">
            <button className={`cc-pill ${ccState}`} onClick={() => setTranscript(true)} aria-label={t("showTranscript")}>
              <span className="dot" />
              {ccState === "ok" ? t("captionsOn") : ccState === "paused" ? t("captionsPaused") : t("captionsUnavailable")}
            </button>
            {group && <span className="cc-pill count">{t("peopleCount", { n: String(s.participants.length + 1) })}</span>}
          </div>
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
            <Ctrl label={s.audioOnly ? t("lblVideo") : t("lblAudioOnly")} title={s.audioOnly ? t("goVideo") : t("goAudioOnly")} onClick={() => call.setAudioOnly(!s.audioOnly)}>
              {s.audioOnly ? <CameraIcon off={false} /> : <AudioOnlyIcon />}
            </Ctrl>
            {group && (
              <Ctrl label={t("lblInRoom")} title={s.inRoom ? t("inRoomOn") : t("inRoomOff")} active={s.inRoom} onClick={() => call.setInRoom(!s.inRoom)}>
                <RoomIcon />
              </Ctrl>
            )}
            <Ctrl label={t("lblText")} title={t("showTranscript")} onClick={() => setTranscript(true)}>
              <TextIcon />
            </Ctrl>
            <Ctrl label={t("lblEnd")} title={t("endCall")} danger onClick={() => (neverConnected ? goHome() : call.leave())}>
              <HangupIcon />
            </Ctrl>
          </div>
        </div>

        {group && s.participants.length > 0 && (
          <div className="people" onClick={(e) => e.stopPropagation()}>
            {s.participants.map((p) => (
              <PersonTile key={p.id} p={p} active={p.id === stage?.id} showVideo={!s.audioOnly && p.videoOk && s.participants.length < 4} />
            ))}
            {s.participants.length + 1 < s.max && (
              <button className="person invite-tile" onClick={() => setInvite(true)} aria-label={t("inviteMore")}>
                <span className="avatar">+</span>
                <span className="person-name">{t("lblInvite")}</span>
              </button>
            )}
          </div>
        )}

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
        <SelfView
          stream={s.selfVideo}
          mirror={facingMirror(s)}
          low={s.phase === "waiting"}
          mode={selfMode}
          onMode={setSelfMode}
          onHide={() => {
            setSelfView(false);
            setSelfMode("small");
          }}
          hideLabel={t("hideSelf")}
          sizeLabel={t("selfSize")}
        />
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

      <Captions captions={s.captions} names={names} lang={call.info.lang.reads} speaking={connected && anySpeaking} />

      {transcript && (
        <Transcript lines={s.transcript} names={s.names} prefs={prefs} onPrefs={changePrefs} onSave={save} onClose={() => setTranscript(false)} onReport={(id) => call.report(id)} onType={(text) => call.sendTyped(text)} />
      )}
      {invite && (
        <div className="sheet invite-sheet" role="dialog" aria-modal="true" aria-label={t("inviteMore")} onClick={(e) => e.stopPropagation()}>
          <header className="sheet-head">
            <h2>{t("inviteMore")}</h2>
            <button className="btn small" autoFocus onClick={() => setInvite(false)}>
              {t("close")}
            </button>
          </header>
          <div className="sheet-body center-body">
            <ShareLink url={shareUrl} qr />
          </div>
        </div>
      )}
    </main>
  );
}

/** One person's audio. Muted (not played) when we're both in the same room. */
function RemoteAudio({ stream, muted, onBlocked }: { stream: MediaStream | null; muted: boolean; onBlocked: (blocked: boolean) => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    if (a.srcObject !== stream) a.srcObject = stream;
    a.muted = muted;
    if (stream && !muted) a.play().then(() => onBlocked(false), () => onBlocked(true));
  }, [stream, muted]);
  return <audio ref={ref} className="remote-audio" autoPlay />;
}

function PersonTile({ p, active, showVideo }: { p: Participant; active: boolean; showVideo: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (v && v.srcObject !== p.stream) {
      v.srcObject = p.stream;
      v.play().catch(() => {});
    }
  }, [p.stream, showVideo]);
  return (
    <div className={`person ${p.speaking ? "speaking" : ""} ${active ? "active" : ""} ${p.connected ? "" : "pending"}`} title={p.name}>
      <div className="avatar">{showVideo && p.stream ? <video ref={ref} autoPlay playsInline muted /> : initials(p.name)}</div>
      <span className="person-name" dir="auto">
        {p.name}
      </span>
      <span className="person-lang">{langInfo(p.lang.speaks).native}</span>
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
}

/** After hanging up: rate the call (development feedback), save the transcript, rejoin. */
function EndScreen({ call, s, onSave, onRejoin }: { call: CallController; s: CallState; onSave: () => void; onRejoin: () => void }) {
  const t = useT();
  const [rating, setRating] = useState<"great" | "ok" | "bad" | null>(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [more, setMore] = useState(false);
  const pending = useRef<string | null>(null);

  const body = (r: string, c: string) =>
    JSON.stringify({
      rating: r,
      comment: c.trim() || undefined,
      room: call.info.room,
      kind: s.kind,
      people: s.peak + 1,
      minutes: s.startedAt && s.endedAt ? Math.round(((s.endedAt - s.startedAt) / 60000) * 10) / 10 : undefined,
      speaks: call.info.lang.speaks,
      reads: call.info.lang.reads,
      audioOnly: s.audioOnly || undefined,
    });
  const post = (b: string) => {
    try {
      if (!navigator.sendBeacon?.("/api/feedback", new Blob([b], { type: "application/json" })))
        fetch("/api/feedback", { method: "POST", body: b, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    } catch {}
  };
  // A rating chosen but never sent (they closed the page) still counts.
  useEffect(() => {
    pending.current = rating && !sent ? body(rating, comment) : null;
  });
  useEffect(() => {
    const flush = () => pending.current && post(pending.current);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const hadCall = s.startedAt !== null;
  const minutes = s.startedAt && s.endedAt ? Math.round((s.endedAt - s.startedAt) / 60000) : 0;
  const duration = minutes < 1 ? t("underMinute") : t("minutesShort", { n: String(minutes) });
  const people = Object.values(s.names).filter(Boolean);
  const hasTranscript = s.transcript.some((l) => l.final);
  // A fresh call of the same kind (one-to-one or group), straight to its join screen.
  const [starting, setStarting] = useState(false);
  const newCall = async () => {
    setStarting(true);
    try {
      const res = await fetch(`/api/rooms?kind=${s.kind}`, { method: "POST" });
      const { code } = (await res.json()) as { code: string };
      location.assign(`/r/${code}`);
    } catch {
      setStarting(false);
    }
  };
  // One tap sends the rating; the comment is optional and never required.
  const rate = (r: "great" | "ok" | "bad") => {
    setRating(r);
    post(body(r, ""));
    setSent(true);
  };
  return (
    <main className="screen center end-screen">
      <div className="end-card">
        <div className="end-badge" aria-hidden="true">
          <LogoMark size={56} />
        </div>
        <h1>{t("callEnded")}</h1>
        {hadCall && <p className="muted">{people.length ? t("callSummary", { minutes: duration, names: people.join(", ") }) : t("callSummaryAlone", { minutes: duration })}</p>}

        <nav className="end-actions">
          <button className="tile primary" onClick={onRejoin}>
            <span className="tile-icon" aria-hidden="true">
              <PhoneIcon />
            </span>
            {t("callAgain")}
          </button>
          <button className="tile" onClick={() => void newCall()} disabled={starting}>
            <span className="tile-icon" aria-hidden="true">
              ＋
            </span>
            {starting ? t("starting") : t("newCall")}
          </button>
          <Link className="tile" href="/">
            <span className="tile-icon" aria-hidden="true">
              ⌂
            </span>
            {t("backHome")}
          </Link>
          {hasTranscript && (
            <button className="tile" onClick={onSave}>
              <span className="tile-icon" aria-hidden="true">
                ⤓
              </span>
              {t("saveTranscript")}
            </button>
          )}
        </nav>

        {hadCall && (
          <section className="quick-rate" aria-label={t("quickRate")}>
            {!sent ? (
              <>
                <span className="muted small">{t("quickRate")}</span>
                <div className="faces" role="group" aria-label={t("quickRate")}>
                  {(["great", "ok", "bad"] as const).map((r) => (
                    <button key={r} className="face" aria-label={r === "great" ? t("rateGreat") : r === "ok" ? t("rateOk") : t("rateBad")} onClick={() => rate(r)}>
                      {r === "great" ? "😀" : r === "ok" ? "😐" : "🙁"}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="thanks-row">
                <span className="small">{t("thanks")}</span>
                {!more && rating && (
                  <button className="link small" onClick={() => setMore(true)}>
                    {t("tellUsMore")}
                  </button>
                )}
                {more && rating && (
                  <div className="more">
                    <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("commentPlaceholder")} maxLength={1000} rows={3} />
                    <button
                      className="btn small primary"
                      onClick={() => {
                        post(body(rating, comment));
                        setMore(false);
                        setComment("");
                      }}
                      disabled={!comment.trim()}
                    >
                      {t("sendFeedback")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
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
function RoomIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" {...svg} aria-hidden="true">
      <path d="M3 10l9-6 9 6v10H3z" />
      <circle cx="9" cy="14" r="1.6" />
      <circle cx="15" cy="14" r="1.6" />
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
