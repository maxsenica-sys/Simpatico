"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { LanguageLine } from "./LanguageLine";
import { Logo } from "./Logo";

const NAME_KEY = "talk.name";
const readName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
};

export type JoinChoice = { audioOnly: boolean; name: string; inRoom?: boolean };

export function JoinScreen({
  stream,
  group,
  onJoin,
}: {
  stream: MediaStream | null;
  /** Set for group calls: asks for a name and whether you're in the same room. */
  group: { max: number } | null;
  onJoin: (choice: JoinChoice) => void;
}) {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const [name, setName] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [missing, setMissing] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => setName(readName()), []);
  useEffect(() => {
    if (video.current && stream) {
      video.current.srcObject = stream;
      video.current.play().catch(() => {});
    }
  }, [stream]);
  const hasVideo = !!stream?.getVideoTracks().length;

  // Everyone gives a name before joining, host included: captions and the transcript say who is talking.
  const join = (audioOnly: boolean) => {
    const n = name.trim();
    if (!n) {
      setMissing(true);
      nameRef.current?.focus();
      return;
    }
    try {
      localStorage.setItem(NAME_KEY, n);
    } catch {}
    onJoin({ audioOnly, name: n, inRoom: group ? inRoom : undefined });
  };

  return (
    <main className="screen join">
      <header className="join-head">
        <Logo small />
        {group && <span className="muted small group-tag">{t("groupCall")}</span>}
      </header>
      <div className="preview">
        {hasVideo ? <video ref={video} className="mirror" autoPlay playsInline muted /> : <div className="preview-empty">{stream ? "" : t("cameraStarting")}</div>}
      </div>
      <section className="join-panel">
        <LanguageLine />
        <label className={`field ${missing ? "invalid" : ""}`}>
          <span>{t("yourName")}</span>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim()) setMissing(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && join(!hasVideo)}
            maxLength={40}
            autoComplete="given-name"
            enterKeyHint="go"
            required
            aria-invalid={missing}
            aria-describedby={missing ? "name-error" : undefined}
          />
          {missing && (
            <span id="name-error" className="field-error" role="alert">
              {t("nameRequired")}
            </span>
          )}
        </label>
        {group && (
          <>
            <label className="check">
              <input type="checkbox" checked={inRoom} onChange={(e) => setInRoom(e.target.checked)} />
              <span>
                {t("inRoomLabel")}
                <small className="muted">{t("inRoomHint")}</small>
              </span>
            </label>
          </>
        )}
        {hasVideo ? (
          <>
            <button className="btn primary big" disabled={!stream} onClick={() => join(false)}>
              {t("joinVideo")}
            </button>
            <button className="btn big secondary" disabled={!stream} onClick={() => join(true)}>
              {t("joinAudio")}
            </button>
          </>
        ) : (
          <button className="btn primary big" disabled={!stream} onClick={() => join(true)}>
            {t("join")}
          </button>
        )}
        <p className="muted consent">
          {t("consent")}{" "}
          <Link href="/privacy" target="_blank">
            {t("privacy")}
          </Link>
        </p>
      </section>
    </main>
  );
}
