"use client";
import { SavedTalks } from "./SavedTalks";
import { clearTalks, setKeepTalks } from "@/lib/saved";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { TabBar } from "./TabBar";
import { MoveSection } from "./MoveSection";
import { BlockedList } from "./BlockedList";
import { loadPhoto, photoFromFile, savePhoto } from "@/lib/photo";
import { forgetPush, notifyEnabled, pushPermission, setNotify as setNotifyPush } from "@/lib/push";
import { detectEnv } from "@/lib/env";
import { loadCaptionPrefs, saveCaptionPrefs, type CaptionPrefs } from "@/lib/captionPrefs";
import { useT } from "@/lib/i18n";
import { MAX_WORDS, TOPICS, clearProfile, countries, loadProfile, readTransfer, saveProfile, transferLink, type Profile, type Transfer } from "@/lib/profile";
import { langFromChoice } from "@/lib/prefs";
import { baseLang } from "@/shared/lang";
import { LANGUAGES } from "@/shared/languages";
import { CaptionSettings } from "./CaptionSettings";
import { useLang } from "./LangRoot";
import { ShareLink } from "./ShareLink";

const SORTED = [...LANGUAGES].sort((a, b) => a.native.localeCompare(b.native));

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "").slice(0, 1)).toUpperCase();
}

/**
 * "Me": who you are, remembered on this phone (no account, nothing on our servers). Changes save
 * as you make them. Used to fill the join screen and, during a call only, to help speech
 * recognition and translation with your accent, words and usual topics.
 */
export function ProfileScreen() {
  const t = useT();
  const { lang, setLang } = useLang();
  // "Your data" (move, clear) stays closed unless you came for it (the home screen's "Bring your data").
  const [dataOpen, setDataOpen] = useState(false);
  const [arriving, setArriving] = useState(false);
  useEffect(() => {
    if (location.hash === "#move") {
      setDataOpen(true);
      setArriving(true);
    }
  }, []);
  const [p, setP] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState<CaptionPrefs | null>(null);
  const [word, setWord] = useState("");
  const [saved, setSaved] = useState(false);
  const [incoming, setIncoming] = useState<Transfer | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [notify, setNotify] = useState(true);
  const [perm, setPerm] = useState<ReturnType<typeof pushPermission>>("default");
  const [iosBrowser, setIosBrowser] = useState(false);
  useEffect(() => {
    setNotify(notifyEnabled());
    setPerm(pushPermission());
    const env = detectEnv();
    setIosBrowser(env.ios && !env.standalone && !env.nativeApp);
  }, []);
  const [photo, setPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setPhoto(loadPhoto()), []);
  const [newLink, setNewLink] = useState(false);
  useEffect(() => {
    setP(loadProfile());
    setPrefs(loadCaptionPrefs());
    setIncoming(readTransfer(location.hash));
  }, []);
  const ui = baseLang(lang.ui) ?? "en";
  const countryList = useMemo(() => countries(ui), [ui]);
  if (!p || !prefs) return <div className="boot" />;

  const flashSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };
  const update = (next: Profile) => {
    setP(next);
    saveProfile(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };
  const addWord = () => {
    const w = word.trim().slice(0, 40);
    if (!w || p.words.includes(w) || p.words.length >= MAX_WORDS) return setWord("");
    update({ ...p, words: [...p.words, w] });
    setWord("");
  };

  // Moving to a new phone: "Your data" comes first, open; otherwise it's the last fold.
  const dataGroup = (
      <details className="pgroup" open={dataOpen}>
        <summary>
          <span>
            {t("meGroupData")}
            <small>{t("meGroupDataSub")}</small>
          </span>
        </summary>
        <div className="pgroup-body">
      <MoveSection arriving={arriving} />

      {!arriving && (
      <section className="pcard quiet">
          <p className="small">{t("profilePrivacy")}</p>
          {!clearing ? (
            <button className="btn small" onClick={() => setClearing(true)}>
              {t("clearProfile")}
            </button>
          ) : (
            <div className="clear-box" role="alertdialog" aria-label={t("clearTitle")}>
              <h3>{t("clearTitle")}</h3>
              <p className="small muted">{t("clearWhat")}</p>
              <label className="clear-opt">
                <input type="checkbox" checked={newLink} onChange={(e) => setNewLink(e.target.checked)} />
                <span>{t("clearNewLink")}</span>
              </label>
              {newLink && <p className="small clear-warn">{t("clearNewLinkWarn")}</p>}
              <div className="clear-actions">
                <button
                  className="btn small danger"
                  onClick={() => {
                    clearProfile(newLink);
                    setKeepTalks(false);
                    void clearTalks();
                    void forgetPush();
                    setP(loadProfile());
                    setPrefs(loadCaptionPrefs());
                    setPhoto(null);
                    setClearing(false);
                    setNewLink(false);
                  }}
                >
                  {t("clearDo")}
                </button>
                <button
                  className="btn small"
                  autoFocus
                  onClick={() => {
                    setClearing(false);
                    setNewLink(false);
                  }}
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
        </div>
      </details>
  );
  return (
    <main className="screen profile with-tabs">
      <header className="profile-head">
        {/* Home is in the bar at the bottom. */}
        <span aria-hidden="true" />
        <h1>{t("profileTitle")}</h1>
        <span className={`saved ${saved ? "on" : ""}`} role="status">
          {saved ? `✓ ${t("saved")}` : ""}
        </span>
      </header>

      {incoming && (
        <section className="pcard import" role="dialog" aria-label={t("importTitle")}>
          <h2>{t("importTitle")}</h2>
          <p className="small">{t("importBody", { name: incoming.profile.name || "?" })}</p>
          <div className="add-row">
            <button
              className="btn primary small"
              onClick={() => {
                const next = { ...loadProfile(), ...incoming.profile };
                saveProfile(next);
                setP(next);
                if (incoming.captions) {
                  saveCaptionPrefs({ ...loadCaptionPrefs(), ...(incoming.captions as Partial<CaptionPrefs>) });
                  setPrefs(loadCaptionPrefs());
                }
                if (incoming.speaks) setLang(langFromChoice(incoming.speaks));
                history.replaceState(null, "", "/profile");
                setIncoming(null);
              }}
            >
              {t("importYes")}
            </button>
            <button
              className="btn small"
              onClick={() => {
                history.replaceState(null, "", "/profile");
                setIncoming(null);
              }}
            >
              {t("notNow")}
            </button>
          </div>
        </section>
      )}

      {dataOpen && dataGroup}
      {/* Who you are, in one compact card: photo (tap it), name, the language you speak. */}
      <section className="pcard me-id">
        <button type="button" className="photo-pick" onClick={() => fileRef.current?.click()} aria-label={photo ? t("changePhoto") : t("addPhoto")}>
          <Avatar className="avatar lg" photo={photo} fallback={initials(p.name) || <PersonGlyph />} />
          <span className="photo-badge" aria-hidden="true">
            <CameraGlyph />
          </span>
        </button>
        <input
          ref={fileRef}
          className="visually-hidden"
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-hidden="true"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              const url = await photoFromFile(f);
              savePhoto(url);
              setPhoto(url);
              flashSaved();
            } catch {}
          }}
        />
        <div className="me-id-fields">
          <label className="field">
            <span>{t("yourName")}</span>
            <input value={p.name} onChange={(e) => update({ ...p, name: e.target.value })} maxLength={40} autoComplete="given-name" />
          </label>
          <label className="field">
            <span>{t("iSpeak")}</span>
            <select className="gender-select" value={baseLang(lang.speaks) ?? "en"} onChange={(e) => setLang(langFromChoice(e.target.value))}>
              {SORTED.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native}
                </option>
              ))}
            </select>
          </label>
          {photo && (
            <button
              type="button"
              className="link small me-photo-remove"
              onClick={() => {
                savePhoto(null);
                setPhoto(null);
                flashSaved();
              }}
            >
              {t("removePhoto")}
            </button>
          )}
        </div>
      </section>
      {/* Everything else is optional and folded away, so a first visit is just the card above. */}
      <details className="pgroup">
        <summary>
          <span>
            {t("profileAbout")}
            <small>{t("meGroupAboutSub")}</small>
          </span>
        </summary>
        <div className="pgroup-body">
          <section className="pcard">
          <label className="field">
            <span>{t("gender")}</span>
            <select className="gender-select" value={p.gender ?? ""} onChange={(e) => update({ ...p, gender: (e.target.value || null) as Profile["gender"] })}>
              <option value="" disabled>
                {t("genderPick")}
              </option>
              <option value="m">{t("genderMale")}</option>
              <option value="f">{t("genderFemale")}</option>
              <option value="x">{t("genderNone")}</option>
            </select>
          </label>
        <label className="field">
          <span>{t("fromLabel")}</span>
          <select className="gender-select" value={p.from ?? ""} onChange={(e) => update({ ...p, from: e.target.value || null })}>
            <option value="">{t("fromNone")}</option>
            {countryList.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <p className="muted small">{t("fromHint")}</p>
          </section>
        </div>
      </details>
      <details className="pgroup">
        <summary>
          <span>
            {t("meGroupWords")}
            <small>{t("meGroupWordsSub")}</small>
          </span>
        </summary>
        <div className="pgroup-body">
      <section className="pcard">
        <h2>{t("wordsTitle")}</h2>
        <p className="muted small">{t("wordsHint")}</p>
        {p.words.length > 0 && (
          <ul className="chips">
            {p.words.map((w) => (
              <li key={w} className="chip">
                {w}
                <button aria-label={`${t("remove")} ${w}`} onClick={() => update({ ...p, words: p.words.filter((x) => x !== w) })}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="add-row">
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addWord()}
            placeholder={t("wordsPlaceholder")}
            maxLength={40}
            enterKeyHint="done"
            aria-label={t("wordsTitle")}
          />
          <button className="btn small primary" onClick={addWord} disabled={!word.trim()}>
            {t("add")}
          </button>
        </div>
      </section>

      <section className="pcard">
        <h2>{t("topicsTitle")}</h2>
        <p className="muted small">{t("topicsHint")}</p>
        <div className="topics">
          {TOPICS.map((tp) => {
            const on = p.topics.includes(tp);
            return (
              <button
                key={tp}
                role="switch"
                aria-checked={on}
                className={`topic ${on ? "on" : ""}`}
                onClick={() => update({ ...p, topics: on ? p.topics.filter((x) => x !== tp) : [...p.topics, tp] })}
              >
                {t(`topic_${tp}`)}
              </button>
            );
          })}
        </div>
      </section>

        </div>
      </details>

      <details className="pgroup">
        <summary>
          <span>
            {t("meGroupCaptions")}
            <small>{t("meGroupCaptionsSub")}</small>
          </span>
        </summary>
        <div className="pgroup-body">
      <section className="pcard">
        <h2>{t("captionsTitle")}</h2>
        <div className="caption-prefs flat">
          <CaptionSettings
            prefs={prefs}
            onPrefs={(n) => {
              setPrefs(n);
              saveCaptionPrefs(n);
              setSaved(true);
              window.setTimeout(() => setSaved(false), 1500);
            }}
          />
        </div>
      </section>

      <section className="pcard">
        <h2>{t("notifyTitle")}</h2>
        <label className="switch-row">
          <span>{t("notifyLabel")}</span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={notify}
            onChange={(e) => {
              const on = e.target.checked;
              setNotify(on);
              void setNotifyPush(on, t("waitingPush", { name: "{name}" })).then(() => setPerm(pushPermission()));
            }}
          />
        </label>
        <p className="muted small">
          {perm === "unsupported"
            ? iosBrowser
              ? t("notifyNeedsHome")
              : t("notifyUnsupported")
            : perm === "denied" && notify
              ? t("notifyBlocked")
              : t("notifyHint")}
        </p>
        {notify && perm === "default" && (
          <button
            className="btn small primary"
            onClick={() => void setNotifyPush(true, t("waitingPush", { name: "{name}" })).then(() => setPerm(pushPermission()))}
          >
            {t("notifyTurnOn")}
          </button>
        )}
      </section>

        </div>
      </details>
      <SavedTalks />

      <BlockedList />

      {!dataOpen && dataGroup}
      <nav className="me-legal small">
        <Link href="/privacy">{t("privacy")}</Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms">{t("terms")}</Link>
        <span aria-hidden="true">·</span>
        <Link href="/support">{t("support")}</Link>
      </nav>
      <TabBar active="me" />
    </main>
  );
}

function CameraGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
function PersonGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4 20.5c0-4.2 3.6-7 8-7s8 2.8 8 7" />
    </svg>
  );
}
