"use client";
import { useEffect, useRef, useState } from "react";
import { loadStrings, type Strings } from "@/i18n";
import { useT } from "@/lib/i18n";
import { canShareLink, shareLink } from "@/lib/native";
import { loadProfile } from "@/lib/profile";
import { forgetRecent, type RecentPerson } from "@/lib/recent";
import { baseLang } from "@/shared/lang";
import { initials } from "./ProfileScreen";

const GRADIENTS = [
  "#5b8cff, #5fe0bd",
  "#ff8a7a, #ffc16b",
  "#b18cff, #5b8cff",
  "#5fe0bd, #3bb7d6",
  "#ffc16b, #ff7ab8",
  "#7ad7ff, #8c9bff",
];
/** A different colour for each circle in the row. */
export function gradient(i: number) {
  return `linear-gradient(135deg, ${GRADIENTS[i % GRADIENTS.length]})`;
}

/** The screen's language, with the phone's region when it matches ("2 Nov" in Australia). */
function uiLang() {
  const ui = (typeof document !== "undefined" && document.documentElement.lang) || "en";
  const phone = typeof navigator !== "undefined" ? navigator.language : "";
  return phone.toLowerCase().startsWith(ui.toLowerCase()) ? phone : ui;
}
const cap = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/** "Today", "Yesterday", "Mon", "2 Nov": in the screen's language. */
export function when(at: number) {
  const lang = uiLang();
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(new Date()) - day(new Date(at))) / 86_400_000);
  if (days <= 1) return cap(new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(-days, "day"));
  if (days < 7) return cap(new Intl.DateTimeFormat(lang, { weekday: "short" }).format(at));
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short" }).format(at);
}

function duration(seconds: number) {
  const lang = uiLang();
  const mins = Math.max(1, Math.round(seconds / 60));
  const unit = (n: number, u: "hour" | "minute") => new Intl.NumberFormat(lang, { style: "unit", unit: u, unitDisplay: "short" }).format(n);
  if (mins < 60) return unit(mins, "minute");
  return mins % 60 ? `${unit(Math.floor(mins / 60), "hour")} ${unit(mins % 60, "minute")}` : unit(mins / 60, "hour");
}

function languageName(tag: string) {
  const b = baseLang(tag) ?? tag;
  try {
    return new Intl.DisplayNames([uiLang()], { type: "language" }).of(b) ?? b;
  } catch {
    return b;
  }
}

/** The home screen's row of the last five people you called. */
export function RecentRow({ people, onPick }: { people: RecentPerson[]; onPick: (p: RecentPerson, color: string) => void }) {
  const t = useT();
  return (
    <section className="recent" aria-label={t("recentTitle")}>
      <div className="recent-head">
        <h2>{t("recentTitle")}</h2>
        <span>{t("recentHint")}</span>
      </div>
      <div className="recent-row">
        {people.slice(0, 5).map((p, i) => (
          <button key={p.name} className="rp" onClick={() => onPick(p, gradient(i))} aria-label={t("callPerson", { name: p.name })}>
            <span className="rp-av" style={{ background: gradient(i) }} aria-hidden="true">
              {initials(p.name)}
            </span>
            <b>{p.name}</b>
            <small>{when(p.at)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Tap someone in Recent: who they are, and one button to call them again. */
export function PersonSheet({ person, color, link, onClose, onCalling, onRemoved }: { person: RecentPerson; color: string; link: string; onClose: () => void; onCalling: () => void; onRemoved: () => void }) {
  const t = useT();
  const [theirs, setTheirs] = useState<Strings | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // The "Join me" message goes out in their language: load it now, so the share sheet can
  // open straight from the tap (phones only allow that directly inside a tap).
  useEffect(() => {
    loadStrings(baseLang(person.lang) ?? "en").then(setTheirs);
  }, [person.lang]);
  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const call = async () => {
    const me = loadProfile().name.trim().split(/\s+/)[0];
    const fill = (s: string) => s.replace(/\{name\}/g, me);
    const text = theirs ? (me ? fill(theirs.inviteText) : theirs.inviteTextAnon) : me ? t("inviteText", { name: me }) : t("inviteTextAnon");
    if (canShareLink()) await shareLink(link, text);
    else
      try {
        await navigator.clipboard.writeText(`${text} ${link}`);
      } catch {}
    onCalling();
  };

  return (
    <div className="bsheet-backdrop" onClick={onClose}>
      <div className="bsheet" role="dialog" aria-modal="true" aria-label={person.name} onClick={(e) => e.stopPropagation()}>
        <div className="bsheet-handle" aria-hidden="true" />
        <button ref={closeBtn} className="round-btn bsheet-close" aria-label={t("close")} onClick={onClose}>
          ×
        </button>
        <div className="pc-av" style={{ background: color }} aria-hidden="true">
          {initials(person.name)}
        </div>
        <h2>{person.name}</h2>
        <div className="pc-facts">
          <span>{t("speaksLang", { lang: languageName(person.lang) })}</span>
          <span>
            {when(person.at)}
            {person.last ? ` · ${duration(person.last)}` : ""}
          </span>
          <span>{person.calls === 1 ? t("oneCall") : t("nCalls", { n: String(person.calls) })}</span>
        </div>
        <div className="bsheet-actions">
          <button className="btn primary big" onClick={() => void call()}>
            <PhoneGlyph /> {t("callPerson", { name: person.name })}
          </button>
          <p className="pc-note">{t("callPersonHint", { name: person.name })}</p>
          <button
            className="link pc-remove"
            onClick={() => {
              forgetRecent(person.name);
              onRemoved();
            }}
          >
            {t("removeRecent")}
          </button>
        </div>
      </div>
    </div>
  );
}

function PhoneGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1z" />
    </svg>
  );
}
