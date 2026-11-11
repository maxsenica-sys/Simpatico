"use client";
import Link from "next/link";
import { Avatar } from "./Avatar";
import { loadPhoto } from "@/lib/photo";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import type { Gender } from "@/shared/protocol";
import { LanguageLine } from "./LanguageLine";
import { Logo } from "./Logo";
import { initials } from "./ProfileScreen";

const NAME_KEY = "talk.name";
const GENDER_KEY = "talk.gender";
const readName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
};

export type JoinChoice = {
  audioOnly: boolean;
  name: string;
  inRoom?: boolean;
  gender?: Gender;
};
type GenderChoice = Gender | "x";

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
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => setPhoto(loadPhoto()), []);
  const [inRoom, setInRoom] = useState(false);
  const [missing, setMissing] = useState(false);
  // Languages like Russian, Arabic or Portuguese need it even for "I" and "you".
  // "x" = prefer not to say: still a choice, and translations use neutral wording.
  const [gender, setGender] = useState<GenderChoice | undefined>(undefined);
  useEffect(() => {
    try {
      const g = localStorage.getItem(GENDER_KEY);
      if (g === "m" || g === "f" || g === "x") setGender(g);
    } catch {}
  }, []);
  const [missingGender, setMissingGender] = useState(false);
  const genderRef = useRef<HTMLSelectElement>(null);
  const pickGender = (g: GenderChoice) => {
    if (g !== "m" && g !== "f" && g !== "x") return;
    setGender(g);
    setMissingGender(false);
    try {
      localStorage.setItem(GENDER_KEY, g);
    } catch {}
  };
  const nameRef = useRef<HTMLInputElement>(null);
  // Known from "Me" (or a previous call): show "Joining as Max · Change" instead of the form.
  const [editing, setEditing] = useState(true);
  useEffect(() => {
    const n = readName();
    setName(n);
    let g: string | null = null;
    try {
      g = localStorage.getItem(GENDER_KEY);
    } catch {}
    setEditing(!(n.trim() && (g === "m" || g === "f" || g === "x")));
  }, []);
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
    if (!n || !gender) {
      setEditing(true);
      setMissing(!n);
      setMissingGender(!gender);
      (n ? genderRef.current : nameRef.current)?.focus();
      return;
    }
    try {
      localStorage.setItem(NAME_KEY, n);
    } catch {}
    onJoin({
      audioOnly,
      name: n,
      inRoom: group ? inRoom : undefined,
      gender: gender === "x" ? undefined : gender,
    });
  };

  return (
    <main className="screen join">
      <header className="join-head">
        <Link href="/" className="round-btn join-back" aria-label={t("backHome")}>
          <BackIcon />
        </Link>
        <Logo small />
        {group && (
          <span className="muted small group-tag">{t("groupCall")}</span>
        )}
      </header>
      <div className="preview">
        {hasVideo ? (
          <video ref={video} className="mirror" autoPlay playsInline muted />
        ) : (
          <div className="preview-empty">
            {stream ? "" : t("cameraStarting")}
          </div>
        )}
      </div>
      <section className="join-panel">
        <LanguageLine />
        {/* Name and gender, side by side: both needed before joining. Gender is for languages
            that change words for "I" and "you" (Russian, Arabic, Portuguese, Hindi…). */}
        {!editing && (
          <div className="joining-as">
            <Avatar photo={photo} fallback={initials(name)} />
            <span>{t("joiningAs", { name: name.trim() })}</span>
            <button
              type="button"
              className="link"
              onClick={() => setEditing(true)}
            >
              {t("changeProfile")}
            </button>
          </div>
        )}
        {editing && (
          <div className="who-row">
            <label className={`field name-field ${missing ? "invalid" : ""}`}>
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
            </label>
            <label
              className={`field gender-field ${missingGender ? "invalid" : ""}`}
            >
              <span>{t("gender")}</span>
              <select
                ref={genderRef}
                className="gender-select"
                value={gender ?? ""}
                onChange={(e) => pickGender(e.target.value as GenderChoice)}
                required
                aria-invalid={missingGender}
                aria-describedby={missingGender ? "gender-error" : undefined}
              >
                <option value="" disabled>
                  {t("genderPick")}
                </option>
                <option value="m">{t("genderMale")}</option>
                <option value="f">{t("genderFemale")}</option>
                <option value="x">{t("genderNone")}</option>
              </select>
            </label>
          </div>
        )}
        {missing && (
          <span id="name-error" className="field-error" role="alert">
            {t("nameRequired")}
          </span>
        )}
        {missingGender && !missing && (
          <span id="gender-error" className="field-error" role="alert">
            {t("genderRequired")}
          </span>
        )}
        {group && (
          <>
            <label className="check">
              <input
                type="checkbox"
                checked={inRoom}
                onChange={(e) => setInRoom(e.target.checked)}
              />
              <span>
                {t("inRoomLabel")}
                <small className="muted">{t("inRoomHint")}</small>
              </span>
            </label>
          </>
        )}
        {hasVideo ? (
          <>
            <button
              className="btn primary big"
              disabled={!stream}
              onClick={() => join(false)}
            >
              {t("joinVideo")}
            </button>
            <button
              className="btn big secondary"
              disabled={!stream}
              onClick={() => join(true)}
            >
              {t("joinAudio")}
            </button>
          </>
        ) : (
          <button
            className="btn primary big"
            disabled={!stream}
            onClick={() => join(true)}
          >
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

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}
