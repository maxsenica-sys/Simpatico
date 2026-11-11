"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadCaptionPrefs, saveCaptionPrefs, type CaptionPrefs } from "@/lib/captionPrefs";
import { useT } from "@/lib/i18n";
import { MAX_WORDS, TOPICS, clearProfile, countries, loadProfile, saveProfile, type Profile } from "@/lib/profile";
import { langFromChoice } from "@/lib/prefs";
import { baseLang } from "@/shared/lang";
import { LANGUAGES } from "@/shared/languages";
import type { Topic } from "@/shared/protocol";
import { CaptionSettings } from "./CaptionSettings";
import { useLang } from "./LangRoot";

const SORTED = [...LANGUAGES].sort((a, b) => a.native.localeCompare(b.native));
const TOPIC_ICON: Record<Topic, string> = { sport: "⚽", family: "👪", work: "💼", school: "🎓", travel: "✈️", food: "🍜", gaming: "🎮", music: "🎵", health: "🩺", faith: "🕊️" };

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
  const [p, setP] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState<CaptionPrefs | null>(null);
  const [word, setWord] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setP(loadProfile());
    setPrefs(loadCaptionPrefs());
  }, []);
  const ui = baseLang(lang.ui) ?? "en";
  const countryList = useMemo(() => countries(ui), [ui]);
  if (!p || !prefs) return <div className="boot" />;

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

  return (
    <main className="screen profile">
      <header className="profile-head">
        <Link href="/" className="round-btn" aria-label={t("backHome")}>
          ←
        </Link>
        <h1>{t("profileTitle")}</h1>
        <span className={`saved ${saved ? "on" : ""}`} role="status">
          {saved ? `✓ ${t("saved")}` : ""}
        </span>
      </header>

      <div className="profile-hero">
        <div className="avatar xl" aria-hidden="true">
          {initials(p.name) || "🙂"}
        </div>
        <p className="muted small">{t("profileIntro")}</p>
      </div>

      <section className="pcard">
        <h2>{t("profileAbout")}</h2>
        <div className="who-row">
          <label className="field name-field">
            <span>{t("yourName")}</span>
            <input value={p.name} onChange={(e) => update({ ...p, name: e.target.value })} maxLength={40} autoComplete="given-name" />
          </label>
          <label className="field gender-field">
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
        </div>
      </section>

      <section className="pcard">
        <h2>{t("profileLanguage")}</h2>
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
                <span aria-hidden="true">{TOPIC_ICON[tp]}</span> {t(`topic_${tp}`)}
              </button>
            );
          })}
        </div>
      </section>

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

      <section className="pcard quiet">
        <p className="small">🔒 {t("profilePrivacy")}</p>
        <button
          className="btn small"
          onClick={() => {
            if (!window.confirm(t("clearConfirm"))) return;
            clearProfile();
            setP(loadProfile());
            setPrefs(loadCaptionPrefs());
          }}
        >
          {t("clearProfile")}
        </button>
      </section>
    </main>
  );
}
