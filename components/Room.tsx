"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CallController } from "@/lib/call";
import { loadCaptionPrefs } from "@/lib/captionPrefs";
import type { RoomKind } from "@/shared/protocol";
import { detectEnv, systemBrowserUrl, type BrowserEnv } from "@/lib/env";
import { useT } from "@/lib/i18n";
import { getLocalMedia, type MediaFailure } from "@/lib/media";
import { peerIdFor } from "@/lib/prefs";
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
  const mediaRef = useRef<MediaStream | null>(null);
  const callRef = useRef<CallController | null>(null);

  useEffect(() => {
    const e = detectEnv();
    setEnv(e);
    fetch(`/api/rooms/${code}`)
      .then(async (r) => (r.ok ? setRoom((await r.json()) as { peers: number; kind: RoomKind; max: number }) : setRoom("gone")))
      .catch(() => setRoom("gone"));
  }, [code]);

  // Ask for camera + mic as soon as we know the room is real, so the preview is live on arrival.
  useEffect(() => {
    if (!env || env.inApp || !env.canCall || typeof room !== "object" || media) return;
    let cancelled = false;
    getLocalMedia(env.ios).then((m) => {
      if (cancelled) {
        if (m instanceof MediaStream) m.getTracks().forEach((tr) => tr.stop());
        return;
      }
      if (m instanceof MediaStream) mediaRef.current = m;
      setMedia(m);
    });
    return () => {
      cancelled = true;
    };
  }, [env, room, media]);

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
      group={room.kind === "group" ? { max: room.max } : null}
      onJoin={({ audioOnly, name, inRoom, gender }) => {
        if (!(media instanceof MediaStream)) return;
        const c = new CallController(code, peerIdFor(code), lang, media, { audioOnly, name, inRoom, gender, captionStyle: loadCaptionPrefs().style, voiceFocus: loadCaptionPrefs().focus });
        callRef.current = c;
        c.start();
        setCall(c);
      }}
    />
  );
}
