"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CallController } from "@/lib/call";
import { loadCaptionPrefs } from "@/lib/captionPrefs";
import { callLang, loadProfile, speakerProfile } from "@/lib/profile";
import type { RoomKind } from "@/shared/protocol";
import { detectEnv, systemBrowserUrl, type BrowserEnv } from "@/lib/env";
import { useT } from "@/lib/i18n";
import { getLocalMedia, type MediaFailure } from "@/lib/media";
import { peerIdFor } from "@/lib/prefs";
import { loadPhoto } from "@/lib/photo";
import { followCards } from "@/lib/push";
import { CallScreen } from "./CallScreen";
import { JoinScreen } from "./JoinScreen";
import { useLang } from "./LangRoot";
import { Notice } from "./Notice";
import { ShareLink } from "./ShareLink";

type RoomCheck = "checking" | "gone" | { peers: number; kind: RoomKind; max: number };

export function Room({ code }: { code: string }) {
  const t = useT();
  const { lang } = useLang();
  const [env, setEnv] = useState<BrowserEnv | null>(null);
  const [room, setRoom] = useState<RoomCheck>("checking");
  const [media, setMedia] = useState<MediaStream | MediaFailure | null>(null);
  const [call, setCall] = useState<CallController | null>(null);
  /** How many times the phone has said no to camera/mic (0 = not refused). */
  const [refused, setRefused] = useState(0);
  /** First visit: explain before the phone's own prompt, so "Don't Allow" isn't tapped by accident. */
  const [explain, setExplain] = useState<boolean | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const callRef = useRef<CallController | null>(null);

  useEffect(() => {
    const e = detectEnv();
    setEnv(e);
    fetch(`/api/rooms/${code}`)
      .then(async (r) => (r.ok ? setRoom((await r.json()) as { peers: number; kind: RoomKind; max: number }) : setRoom("gone")))
      .catch(() => setRoom("gone"));
  }, [code]);

  useEffect(() => {
    if (!env || env.inApp || !env.canCall || typeof room !== "object" || explain !== null) return;
    needsExplainer().then(setExplain);
  }, [env, room, explain]);

  // Ask for camera + mic as soon as we know the room is real, so the preview is live on arrival.
  useEffect(() => {
    if (!env || env.inApp || !env.canCall || typeof room !== "object" || media || explain !== false) return;
    let cancelled = false;
    getLocalMedia(env.ios).then((m) => {
      if (cancelled) {
        if (m instanceof MediaStream) m.getTracks().forEach((tr) => tr.stop());
        return;
      }
      if (m instanceof MediaStream) {
        mediaRef.current = m;
        try {
          localStorage.setItem(MEDIA_OK_KEY, "1");
        } catch {}
      }
      // "Don't Allow" is not an error: carry on with no camera or mic, and offer to ask again.
      if (m === "denied") {
        setRefused((n) => n + 1);
        setMedia(new MediaStream());
        return;
      }
      setMedia(m);
    });
    return () => {
      cancelled = true;
    };
  }, [env, room, media, explain]);

  // The call and the camera live as long as this page does.
  useEffect(
    () => () => {
      callRef.current?.dispose();
      mediaRef.current?.getTracks().forEach((tr) => tr.stop());
    },
    [],
  );

  const url = typeof location !== "undefined" ? `${location.origin}/r/${code}` : "";

  if (!env || room === "checking") return <div className="boot" />;

  if (env.inApp) {
    const browser = env.android ? "Chrome" : "Safari";
    const deep = systemBrowserUrl(env, url);
    return (
      <Notice tone="warn" title={t("inAppTitle", { browser })} body={<p>{t("inAppBody")} {env.android ? t("inAppStepsAndroid") : t("inAppStepsIos")}</p>}>
        {deep && (
          <a className="btn primary" href={deep}>
            {t("openIn", { browser })}
          </a>
        )}
        <ShareLink url={url} compact />
      </Notice>
    );
  }
  if (!env.canCall) return <Notice tone="warn" title={t("unsupported")} />;
  if (room === "gone")
    return (
      <Notice title={t("roomGone")}>
        <Link className="btn primary" href="/">
          {t("startNew")}
        </Link>
      </Notice>
    );

  if (explain)
    return (
      <Notice
        title={t("permTitle")}
        body={
          <p>
            {t("permBody")}
          </p>
        }
        icon="🎥"
      >
        <button className="btn primary big" autoFocus onClick={() => setExplain(false)}>
          {t("permContinue")}
        </button>
        <Link className="btn big secondary" href="/">
          {t("backHome")}
        </Link>
      </Notice>
    );

  if (media === "denied") {
    const steps = env.nativeApp ? t("deniedApp") : env.ios ? t("deniedIos") : env.android ? t("deniedAndroid") : t("deniedDesktop");
    return (
      <Notice tone="warn" title={t("deniedTitle")} body={<p>{steps}</p>}>
        <button className="btn primary" onClick={() => location.reload()}>
          {t("reload")}
        </button>
      </Notice>
    );
  }
  if (media === "maybe-in-app") {
    const deep = systemBrowserUrl(env, url);
    return (
      <Notice tone="warn" title={t("inAppTitle", { browser: "Safari" })} body={<p>{t("inAppBody")} {t("inAppStepsIos")}</p>}>
        {deep && (
          <a className="btn primary" href={deep}>
            {t("openIn", { browser: "Safari" })}
          </a>
        )}
        <ShareLink url={url} compact />
      </Notice>
    );
  }
  if (media === "no-device" || media === "other")
    return (
      <Notice tone="warn" title={media === "no-device" ? t("noMic") : t("mediaError")}>
        <button className="btn primary" onClick={() => setMedia(null)}>
          {t("retry")}
        </button>
      </Notice>
    );

  if (call) return <CallScreen call={call} shareUrl={url} onRejoin={() => location.reload()} />;

  return (
    <JoinScreen
      stream={media instanceof MediaStream ? media : null}
      refused={
        refused > 0 && media instanceof MediaStream && !media.getTracks().length
          ? {
              again: refused > 1,
              steps: env.nativeApp ? t("deniedApp") : env.ios ? t("deniedIos") : env.android ? t("deniedAndroid") : t("deniedDesktop"),
              onAllow: () => setMedia(null),
            }
          : null
      }
      group={room.kind === "group" ? { max: room.max } : null}
      onJoin={({ audioOnly, name, inRoom, gender }) => {
        // From this tap: the phone may ask once about "someone's waiting" notifications.
        void followCards(t("waitingPush", { name: "{name}" }), { ask: true, extra: code });
        const me = loadProfile();
        if (!(media instanceof MediaStream)) return;
        const c = new CallController(code, peerIdFor(code), callLang(lang, me), media, {
          audioOnly,
          name,
          inRoom,
          gender,
          profile: speakerProfile(me),
          photo: loadPhoto(),
          captionStyle: loadCaptionPrefs().style,
          voiceFocus: loadCaptionPrefs().focus,
        });
        callRef.current = c;
        c.start();
        setCall(c);
      }}
    />
  );
}

const MEDIA_OK_KEY = "talk.mediaOk";

/** Show the "camera and microphone" explainer only before the phone has ever been asked. */
async function needsExplainer(): Promise<boolean> {
  try {
    if (localStorage.getItem(MEDIA_OK_KEY)) return false;
  } catch {}
  try {
    const q = (name: string) => navigator.permissions.query({ name } as unknown as PermissionDescriptor).then((r) => r.state);
    const [cam, mic] = await Promise.all([q("camera"), q("microphone")]);
    return cam === "prompt" || mic === "prompt";
  } catch {
    return false;
  }
}
