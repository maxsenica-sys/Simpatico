"use client";
import { keepsTalks, saveTalk, setKeepTalks, type SavedTalk } from "@/lib/saved";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { worst, type CallController, type CallState, type Participant } from "@/lib/call";
import { CAPTION_SIZES, loadCaptionPrefs, saveCaptionPrefs, type CaptionPrefs } from "@/lib/captionPrefs";
import { saveTranscript, transcriptText } from "@/lib/transcriptFile";
import { langInfo } from "@/shared/lang";
import { useT } from "@/lib/i18n";
import { BRAND } from "@/shared/brand";
import { Captions } from "./Captions";
import { CaptionBox } from "./CaptionBox";
import { LogoMark } from "./Logo";
import { Notice } from "./Notice";
import { SelfView, type SelfMode } from "./SelfView";
import { ShareLink } from "./ShareLink";
import { Transcript } from "./Transcript";
import { detectEnv } from "@/lib/env";
import { suggestNames } from "@/lib/suggest";
import { MAX_WORDS, loadProfile, saveProfile } from "@/lib/profile";
import { followCards, notifyEnabled, pushPermission } from "@/lib/push";
import { noteCall, notePair, notePhoto, noteTime } from "@/lib/recent";
import { myKey, pairCode } from "@/lib/pair";
import { Avatar } from "./Avatar";
import { ReportSheet } from "./ReportSheet";
import { OwnWords } from "./OwnWords";
import { answerSource, sourceAsked } from "@/lib/source";

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
  const [selfMode, setSelfMode] = useState<SelfMode>("small");
  const [transcript, setTranscript] = useState(false);
  const [more, setMore] = useState(false);
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const [now, setNow] = useState(() => Date.now());
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [reportFor, setReportFor] = useState<{ name: string; seat: string } | null>(null);
  // Their name over the video shows for a few seconds when they appear, then gets out of the way.
  const [labelSince, setLabelSince] = useState(() => Date.now());

  // "Recent" on the home screen: remember who we actually talked to, and for how long.
  const met = useRef(new Map<string, string>());
  const photos = useRef(new Map<string, string | null>());
  const timed = useRef(false);
  const latest = useRef(s);
  latest.current = s;
  // Notifications already allowed: once really in a call card's room, follow that card too.
  // (Never ask from here: a system question while the camera and mic start can interrupt them.)
  const followed = useRef(false);
  useEffect(() => {
    if (s.phase !== "connected" || followed.current) return;
    followed.current = true;
    void followCards(t("waitingPush", { name: "{name}" }), { ask: false, extra: call.info.room });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase]);
  // Our own room with each person (lib/pair.ts): remembered in Recent, followed for "waiting".
  const paired = useRef(new Set<string>());
  useEffect(() => {
    const me = myKey();
    for (const p of s.participants) {
      if (!p.connected || !p.key || !me || paired.current.has(p.id)) continue;
      paired.current.add(p.id);
      const name = p.name;
      void pairCode(me, p.key).then((code) => {
        notePair(name, code);
        if (pushPermission() === "granted") void followCards(t("waitingPush", { name: "{name}" }), { ask: false, extra: code });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.participants]);
  useEffect(() => {
    for (const p of s.participants)
      if (p.connected && !met.current.has(p.id)) {
        met.current.set(p.id, p.name);
        noteCall(p.name, p.lang.speaks, call.info.room);
      }
    for (const p of s.participants)
      if (met.current.has(p.id) && photos.current.get(p.id) !== p.photo && (p.photo || photos.current.has(p.id))) {
        photos.current.set(p.id, p.photo);
        notePhoto(p.name, p.photo);
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
  const [prefs, setPrefs] = useState<CaptionPrefs>({ size: "m", box: false, style: "instant", focus: true, long: "room" });
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
  // For people who keep their conversations on this phone: save as the call goes (and at the end),
  // so nothing is lost if the phone locks, the app closes or the battery dies.
  const talk = (): SavedTalk => ({
    id: `call-${call.info.room}-${s.startedAt ?? 0}`,
    kind: s.kind === "group" ? "group" : "pair",
    startedAt: s.startedAt ?? Date.now(),
    endedAt: s.endedAt ?? Date.now(),
    with: Object.values(s.names).filter(Boolean),
    langs: [call.info.lang.speaks, ...new Set(s.participants.map((p) => p.lang.speaks))].filter(Boolean),
    lines: s.transcript
      .filter((l) => l.final && l.text && !l.media)
      .map((l) => ({ who: l.who, name: l.from ? s.names[l.from] : undefined, said: l.who === "me" ? l.text : l.other, read: l.who === "me" ? l.other : l.text, at: l.at })),
  });
  const talkRef = useRef(talk);
  talkRef.current = talk;
  const finals = s.transcript.filter((l) => l.final).length + s.transcript.filter((l) => l.other).length;
  useEffect(() => {
    if (!s.startedAt || !finals || !keepsTalks()) return;
    const id = setTimeout(() => void saveTalk(talkRef.current()), s.phase === "ended" ? 0 : 3000);
    return () => clearTimeout(id);
  }, [finals, s.phase, s.startedAt]);
  useEffect(() => {
    const now = () => {
      if (keepsTalks() && talkRef.current().lines.length) void saveTalk(talkRef.current());
    };
    const hidden = () => document.visibilityState !== "visible" && now();
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", now);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", now);
    };
  }, []);
  const save = () => {
    const names = { ...s.names };
    const text = transcriptText(s.transcript, names, t("you"), t("transcriptTitle"), { image: `[${t("mediaPhoto")}]`, video: `[${t("mediaVideo")}]` });
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
  // The name label and "Captions on" start their few seconds again whenever the call (re)connects
  // or someone else is on the main screen.
  useEffect(() => {
    if (s.phase === "connected") setLabelSince(Date.now());
  }, [s.phase, stage?.id]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Photos and videos count as seen while the messages are open.
  useEffect(() => {
    if (transcript && s.unreadMedia) call.markMediaSeen();
  }, [transcript, s.unreadMedia, call]);

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

  if (s.phase === "ended") return <EndScreen call={call} s={s} onSave={save} onRejoin={onRejoin}  onKeep={() => void saveTalk(talk())} />;
  if (s.phase === "unavailable")
    return (
      <Notice title={t("personUnavailable")}>
        <Link className="btn primary" href="/">
          {t("backHome")}
        </Link>
      </Notice>
    );
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
  const neverConnected = s.startedAt === null;
  // Always gets you home: even if something in the call has gone wrong, the page is replaced.
  const goHome = () => {
    try {
      call.cancel();
    } catch {}
    window.location.assign("/");
  };
  const end = () => {
    if (neverConnected) return goHome();
    try {
      call.leave();
    } catch {
      goHome();
    }
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
        : stage.bg && !stage.away && !group
        ? t("isOnVoice", { name: stage.name }) // their picture (or initials), and why there is no video
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
  // Your own recent sentences, for the scrollable "You" panel.
  const ownLines = s.transcript.filter((l) => l.who === "me" && l.text.trim()).slice(-80);
  const showOwnHint = showOwn && firstOwnAt !== null && now - firstOwnAt < 8000;
  const names = Object.fromEntries(s.participants.map((p) => [p.id, p.name]));
  const anySpeaking = s.participants.some((p) => p.speaking);

  const blockedSteps = (() => {
    if (!s.problems.includes("mic-blocked") && !s.problems.includes("camera-blocked")) return "";
    const env = detectEnv();
    return env.nativeApp ? t("deniedApp") : env.ios ? t("deniedIos") : env.android ? t("deniedAndroid") : t("deniedDesktop");
  })();
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
      if (p === "mic-blocked" || p === "camera-blocked")
        banners.push({
          key: p,
          tone: "warn",
          text: `${p === "mic-blocked" ? t("micBlocked") : t("cameraBlocked")} ${blockedSteps}`,
          actions: (
            <button className="btn small" onClick={() => call.dismissProblem(p)}>
              {t("notNow")}
            </button>
          ),
        });
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
    // In another app but still on the line. One-to-one, that is said under their picture; in a group, here.
    for (const p of s.participants) if (p.bg && !p.away && (group || p.id !== stage?.id)) banners.push({ key: `bg-${p.id}`, tone: "info", text: t("isOnVoice", { name: p.name }) });
    for (const p of s.participants) if (p.noMic && !p.away) banners.push({ key: `nomic-${p.id}`, tone: "info", text: t("peerNoMic", { name: p.name }) });
    // A photo or video just arrived: say who from, with a way to see it (the Text button keeps a count).
    const lastMedia = [...s.transcript].reverse().find((l) => l.media && l.who === "them");
    if (s.unreadMedia && lastMedia && now - lastMedia.at < 8000)
      banners.push({
        key: `media-${lastMedia.id}`,
        tone: "info",
        text: t("mediaArrived", { name: (lastMedia.from && names[lastMedia.from]) || "" }),
        actions: (
          <button className="btn small primary" onClick={() => setTranscript(true)}>
            {t("mediaView")}
          </button>
        ),
      });
    if (ccState !== "ok")
      banners.push({ key: "cc", tone: "warn", text: ccState === "paused" ? t("captionsPaused") : t("captionsUnavailable") });
    if (s.noMic) {
      if (!s.problems.includes("mic-blocked")) banners.push({ key: "nomic", tone: "info", text: t("micOffTap") });
    } else if (s.muted) banners.push({ key: "muted", tone: "info", text: t("muted") });
  } else {
    // Waiting or connecting: a Mic or Camera tap that the phone refuses still says why.
    for (const p of s.problems) {
      if (p === "mic-blocked" || p === "camera-blocked")
        banners.push({
          key: p,
          tone: "warn",
          text: `${p === "mic-blocked" ? t("micBlocked") : t("cameraBlocked")} ${blockedSteps}`,
          actions: (
            <button className="btn small" onClick={() => call.dismissProblem(p)}>
              {t("notNow")}
            </button>
          ),
        });
      if (p === "camera-failed")
        banners.push({
          key: p,
          tone: "warn",
          text: t("cameraFailed"),
          actions: (
            <button className="btn small" onClick={() => call.dismissProblem("camera-failed")}>
              {t("notNow")}
            </button>
          ),
        });
    }
  }

  return (
    <main
      className={`call ${group ? "group" : ""} ${prefs.box ? "cap-box" : ""} ${s.camOn && s.selfVideo && selfMode === "split" ? "split" : ""}`}
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
          {group || stage.photo || stage.bg ? (
            <Avatar className={`avatar big ${stage.speaking ? "speaking" : ""}`} photo={stage.photo} fallback={initials(stage.name)} />
          ) : (
            <div className="no-video-icon" aria-hidden="true">
              {stageAudioOnly ? <AudioOnlyIcon size={44} /> : <CameraIcon off size={44} />}
            </div>
          )}
          {stage.name && (
            <button className="stage-name" onClick={() => setReportFor({ name: stage.name, seat: stage.id })} aria-label={t("reportBlockTitle", { name: stage.name })}>
              {stage.name} <span aria-hidden="true">⋯</span>
            </button>
          )}
          {placeholder && <p>{placeholder}</p>}
        </div>
      )}
      {connected && stage?.name && placeholder === null && (
        <button className={`stage-label ${now - labelSince > 5000 ? "quiet" : ""}`} onClick={() => setReportFor({ name: stage.name, seat: stage.id })} aria-label={t("reportBlockTitle", { name: stage.name })}>
          {stage.name} <span aria-hidden="true">⋯</span>
        </button>
      )}

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
            <div className="pills-l">
            <button className={`cc-pill ${ccState} ${ccState === "ok" && now - labelSince > 6000 ? "quiet" : ""}`} onClick={() => setTranscript(true)} aria-label={t("showTranscript")}>
              <span className="dot" />
              {ccState === "ok" ? t("captionsOn") : ccState === "paused" ? t("captionsPaused") : t("captionsUnavailable")}
            </button>
            {group && <span className="cc-pill count">{t("peopleCount", { n: String(s.participants.length + 1) })}</span>}
            </div>
            {/* How long the call has run: small, faint and still, centred under the buttons. */}
            {s.startedAt !== null && (
              <span className="call-time" role="timer" aria-label={t("callLength")}>
                {clock(now - s.startedAt)}
              </span>
            )}
          </div>
          <div className="controls">
            <Ctrl label={t("lblMic")} title={s.muted ? t("unmute") : t("mute")} danger={s.muted} active={s.meSpeaking && !s.muted} onClick={() => call.setMuted(!s.muted)}>
              <MicIcon off={s.muted} />
            </Ctrl>
            {/* Second slot: the camera, or the way back to video once on audio only. */}
            {!s.audioOnly ? (
              <Ctrl label={t("lblCamera")} title={s.camOn ? t("cameraOff") : t("cameraOn")} danger={!s.camOn} onClick={() => call.setCamera(!s.camOn)}>
                <CameraIcon off={!s.camOn} />
              </Ctrl>
            ) : (
              <Ctrl label={t("lblVideo")} title={t("goVideo")} onClick={() => call.setAudioOnly(false)}>
                <CameraIcon off={false} />
              </Ctrl>
            )}
            <Ctrl label={t("lblText")} title={t("showTranscript")} badge={s.unreadMedia} onClick={() => setTranscript(true)}>
              <TextIcon />
            </Ctrl>
            {/* Things changed once or rarely live under More, so five buttons fit in one row
                with their labels on one line in every language. */}
            <Ctrl label={t("lblMore")} title={t("moreTitle")} active={s.inRoom} onClick={() => setMore((v) => !v)}>
              <MoreIcon />
            </Ctrl>
            <Ctrl label={t("lblEnd")} title={t("endCall")} danger onClick={end}>
              <HangupIcon />
            </Ctrl>
          </div>
          {more && (
            <div className="more-menu" role="menu">
              {!s.audioOnly && (
                <button
                  role="menuitem"
                  aria-label={t("goAudioOnly")}
                  onClick={() => {
                    call.setAudioOnly(true);
                    setMore(false);
                  }}
                >
                  <AudioOnlyIcon />
                  <span>{t("lblAudioOnly")}</span>
                </button>
              )}
              <button
                role="menuitemcheckbox"
                aria-checked={s.inRoom}
                className={s.inRoom ? "on" : ""}
                onClick={() => {
                  call.setInRoom(!s.inRoom);
                  setMore(false);
                }}
              >
                <RoomIcon />
                <span>
                  {t("inRoomLabel")}
                  <small>{t("inRoomHint")}</small>
                </span>
                <i className="more-check" aria-hidden="true">
                  {s.inRoom ? "✓" : ""}
                </i>
              </button>
              {!group && stage?.name && (
                <button
                  role="menuitem"
                  onClick={() => {
                    setReportFor({ name: stage.name, seat: stage.id });
                    setMore(false);
                  }}
                >
                  <FlagIcon />
                  <span>{t("reportBlockTitle", { name: stage.name })}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {group && s.participants.length > 0 && (
          <div className="people" onClick={(e) => e.stopPropagation()}>
            {s.participants.map((p) => (
              <PersonTile key={p.id} p={p} active={p.id === stage?.id} showVideo={!s.audioOnly && p.videoOk && s.participants.length < 4} onMore={() => setReportFor({ name: p.name, seat: p.id })} />
            ))}
            {s.participants.length + 1 < s.max && (
              <button className="person invite-tile" onClick={() => setInvite(true)} aria-label={t("inviteMore")}>
                <span className="avatar">+</span>
                <span className="person-name">{t("lblInvite")}</span>
              </button>
            )}
          </div>
        )}

        {(banners.length > 0 || (connected && ownLines.length > 0)) && (
          <div className="banners" onClick={(e) => e.stopPropagation()}>
            {banners.map((b) => (
              <div key={b.key} className={`banner ${b.tone}`}>
                <p>{b.text}</p>
                {b.actions && <div className="banner-actions">{b.actions}</div>}
              </div>
            ))}
            {connected && (
              <OwnWords
                lines={ownLines}
                lastAt={s.ownLine?.at ?? null}
                speaking={s.meSpeaking && !s.muted}
                hint={!!showOwnHint}
              />
            )}
          </div>
        )}
      </div>

      {s.camOn && s.selfVideo && (
        <SelfView
          stream={s.selfVideo}
          mirror={facingMirror(s)}
          low={s.phase === "waiting"}
          mode={selfMode}
          onMode={setSelfMode}
          onFlip={s.canSwitchCamera ? () => void call.switchCamera() : undefined}
          flipLabel={t("switchCamera")}
          sizeLabel={t("selfSize")}
        />
      )}

      {prefs.long === "room" ? (
        <CaptionBox captions={s.captions} names={names} lang={call.info.lang.reads} speaking={connected && anySpeaking} />
      ) : (
        <Captions captions={s.captions} names={names} lang={call.info.lang.reads} speaking={connected && anySpeaking} onEarlier={() => setTranscript(true)} />
      )}

      {reportFor && (
        <ReportSheet
          name={reportFor.name}
          room={call.info.room}
          seat={reportFor.seat}
          onClose={() => setReportFor(null)}
          onBlocked={() => {
            setReportFor(null);
            // One-to-one: blocking them ends the call. In a group you stay with the others.
            if (!group) end();
          }}
        />
      )}
      {transcript && (
        <Transcript lines={s.transcript} names={s.names} prefs={prefs} onPrefs={changePrefs} onSave={save} onClose={() => setTranscript(false)} onReport={(id) => call.report(id)} onType={(text) => call.sendTyped(text)} onMedia={(file) => call.sendMedia(file)} />
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

function PersonTile({ p, active, showVideo, onMore }: { p: Participant; active: boolean; showVideo: boolean; onMore: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (v && v.srcObject !== p.stream) {
      v.srcObject = p.stream;
      v.play().catch(() => {});
    }
  }, [p.stream, showVideo]);
  return (
    <div
      className={`person ${p.speaking ? "speaking" : ""} ${active ? "active" : ""} ${p.connected ? "" : "pending"}`}
      title={p.name}
      role="button"
      tabIndex={0}
      onClick={onMore}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onMore()}
    >
      {showVideo && p.stream ? (
        <div className="avatar">
          <video ref={ref} autoPlay playsInline muted />
        </div>
      ) : (
        <Avatar photo={p.photo} fallback={initials(p.name)} />
      )}
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

/** After hanging up: call again, a new call, save the transcript. */
function EndScreen({ call, s, onSave, onRejoin, onKeep }: { call: CallController; s: CallState; onSave: () => void; onRejoin: () => void; onKeep?: () => void }) {
  const t = useT();
  const [keep, setKeep] = useState(false);
  useEffect(() => setKeep(keepsTalks()), []);
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

        {hasTranscript && onKeep && (
          <label className="check end-keep">
            <input
              type="checkbox"
              checked={keep}
              onChange={(e) => {
                setKeep(e.target.checked);
                setKeepTalks(e.target.checked);
                if (e.target.checked) onKeep();
              }}
            />
            <span>
              {keep ? t("talkKept") : t("keepTalks")}
              <small className="muted">{t("keepTalksHint")}</small>
            </span>
          </label>
        )}

        {hadCall && <SourceCard />}
        {hadCall && <LearnCard s={s} />}
        {hadCall && <NotifyCard room={call.info.room} />}
        {hadCall && <AddToHome />}

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
  badge,
  onClick,
  children,
}: {
  label: string;
  title: string;
  danger?: boolean;
  active?: boolean;
  /** A count on the button (new photos and videos on Text). */
  badge?: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button className={`ctrl ${danger ? "danger" : ""} ${active ? "active" : ""}`} aria-label={title} title={title} onClick={onClick}>
      <span className="round">
        {children}
        {!!badge && <span className="badge">{badge}</span>}
      </span>
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
function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

/** 4:07, or 1:04:07 once past the hour. */
function clock(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), ss = String(sec % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
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

const A2HS_KEY = "talk.a2hs";
const A2HS_AGAIN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * After a real call, in a browser tab: suggest keeping Simpatico on the Home Screen. That's what
 * lets an iPhone show "someone's waiting" notifications, and it opens in one tap. "Not now" hides
 * it for a week.
 */
function AddToHome() {
  const t = useT();
  const [show, setShow] = useState<null | "ios" | "android" | "other">(null);
  useEffect(() => {
    const env = detectEnv();
    if (env.standalone || env.nativeApp || env.inApp) return;
    try {
      const last = Number(localStorage.getItem(A2HS_KEY) ?? 0);
      if (Date.now() - last < A2HS_AGAIN_MS) return;
    } catch {}
    setShow(env.ios ? "ios" : env.android ? "android" : "other");
  }, []);
  if (!show || show === "other") return null;
  return (
    <section className="a2hs" aria-label={t("a2hsTitle")}>
      <div className="a2hs-icon" aria-hidden="true">
        <LogoMark size={40} />
      </div>
      <div className="a2hs-text">
        <b>{t("a2hsTitle")}</b>
        <p className="small muted">{t("a2hsBody")}</p>
        <p className="small a2hs-steps">{show === "ios" ? t("a2hsIos") : t("a2hsAndroid")}</p>
      </div>
      <button
        className="link a2hs-later"
        onClick={() => {
          try {
            localStorage.setItem(A2HS_KEY, String(Date.now()));
          } catch {}
          setShow(null);
        }}
      >
        {t("notNow")}
      </button>
    </section>
  );
}

/**
 * After a call: one tap to be told when someone's waiting on this call card (and your own).
 * Asked here, not while a call is starting, because a system question on top of a starting
 * camera and mic can interrupt them on iPhones. Already allowed: follows this card silently.
 */
function NotifyCard({ room }: { room: string }) {
  const t = useT();
  const [show, setShow] = useState(false);
  const text = t("waitingPush", { name: "{name}" });
  useEffect(() => {
    if (!notifyEnabled()) return;
    const perm = pushPermission();
    if (perm === "granted") void followCards(text, { ask: false, extra: room });
    else if (perm === "default") setShow(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);
  if (!show) return null;
  return (
    <section className="a2hs" aria-label={t("notifyLabel")}>
      <div className="a2hs-icon" aria-hidden="true">
        <BellGlyph />
      </div>
      <div className="a2hs-text">
        <b>{t("notifyLabel")}</b>
        <p className="small muted">{t("notifyHint")}</p>
        <div className="a2hs-buttons">
          <button
            className="btn small primary"
            onClick={() => {
              void followCards(text, { ask: true, extra: room });
              setShow(false);
            }}
          >
            {t("notifyTurnOn")}
          </button>
          <button className="link a2hs-later" onClick={() => setShow(false)}>
            {t("notNow")}
          </button>
        </div>
      </div>
    </section>
  );
}

function BellGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

/**
 * After a call: "Help it hear you next time". Names that came up in this call, picked out on
 * this phone from its captions, one tap to save each to the profile (they then help speech
 * recognition and translation for everyone in your next calls), plus a box for anything it
 * got wrong. Nothing from the call is sent or kept.
 */
function LearnCard({ s }: { s: CallState }) {
  const t = useT();
  const [saved, setSaved] = useState<string[]>([]);
  const [word, setWord] = useState("");
  const [suggestions] = useState(() => {
    const me = loadProfile();
    const known = [me.name, ...me.words, ...Object.values(s.names)].filter(Boolean);
    return suggestNames(
      s.transcript.filter((l) => l.final).map((l) => l.text),
      known,
    );
  });
  const add = (w: string) => {
    const clean = w.replace(/[<>"]/g, "").trim().slice(0, 40);
    if (!clean) return;
    const me = loadProfile();
    if (!me.words.some((x) => x.toLocaleLowerCase() === clean.toLocaleLowerCase())) {
      saveProfile({ ...me, words: [...me.words, clean].slice(-MAX_WORDS) });
    }
    setSaved((x) => (x.includes(clean) ? x : [...x, clean]));
  };
  return (
    <section className="learn-card" aria-label={t("learnTitle")}>
      <b>{t("learnTitle")}</b>
      <p className="small muted">{suggestions.length ? t("learnHint") : t("learnHintNone")}</p>
      {suggestions.length > 0 && (
        <div className="learn-chips">
          {suggestions.map((w) => {
            const done = saved.includes(w);
            return (
              <button key={w} type="button" className={`chip ${done ? "on" : ""}`} onClick={() => add(w)} disabled={done} aria-pressed={done}>
                {done ? "✓ " : "+ "}
                {w}
              </button>
            );
          })}
        </div>
      )}
      <form
        className="learn-add"
        onSubmit={(e) => {
          e.preventDefault();
          add(word);
          setWord("");
        }}
      >
        <input value={word} onChange={(e) => setWord(e.target.value)} placeholder={t("learnPlaceholder")} maxLength={40} enterKeyHint="done" />
        <button className="btn small" type="submit" disabled={!word.trim()}>
          {t("learnAdd")}
        </button>
      </form>
      {saved.filter((w) => !suggestions.includes(w)).length > 0 && (
        <p className="small learn-saved">✓ {saved.filter((w) => !suggestions.includes(w)).join(", ")}</p>
      )}
      <p className="small muted learn-privacy">{t("learnPrivacy")}</p>
    </section>
  );
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}

/** Once, after the first call: where they found Simpatico (one tap, or close it). */
function SourceCard() {
  const t = useT();
  const [state, setState] = useState<"ask" | "thanks" | "gone">("gone");
  useEffect(() => setState(sourceAsked() ? "gone" : "ask"), []);
  if (state === "gone") return null;
  if (state === "thanks") return <p className="small muted source-thanks">{t("sourceThanks")}</p>;
  const pick = (a: "tiktok" | "instagram" | "friend" | "other" | null) => {
    answerSource(a);
    setState(a ? "thanks" : "gone");
  };
  return (
    <section className="source-card" aria-label={t("sourceTitle")}>
      <div className="source-head">
        <b>{t("sourceTitle")}</b>
        <button className="link small" onClick={() => pick(null)} aria-label={t("close")}>
          ×
        </button>
      </div>
      <div className="source-opts">
        <button className="btn small" onClick={() => pick("tiktok")}>TikTok</button>
        <button className="btn small" onClick={() => pick("instagram")}>Instagram</button>
        <button className="btn small" onClick={() => pick("friend")}>{t("sourceFriend")}</button>
        <button className="btn small" onClick={() => pick("other")}>{t("sourceOther")}</button>
      </div>
    </section>
  );
}
