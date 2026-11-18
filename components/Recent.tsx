"use client";
import { useEffect, useRef, useState } from "react";
import { loadStrings, type Strings } from "@/i18n";
import { useT } from "@/lib/i18n";
import { canShareLink, shareLink } from "@/lib/native";
import { loadProfile } from "@/lib/profile";
import { forgetRecent, samePerson, type RecentPerson } from "@/lib/recent";
import type { Waiting } from "@/lib/waiting";
import { baseLang } from "@/shared/lang";
import { Avatar } from "./Avatar";
import { ReportSheet } from "./ReportSheet";
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

/** The home screen's row of the last five people you called. Tap: call them. Hold: details. */
/** The same colour for the same person on every screen. */
function colorFor(name: string) {
  let h = 0;
  for (const ch of name.trim().toLocaleLowerCase()) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return gradient(h);
}

/**
 * People as a list, one per row: tap to call, hold (or right-click) for details. The home screen
 * shows the five most recent with a way to "All contacts"; the Contacts screen shows everyone,
 * with the language they speak (it tells two people with the same name apart, and says what
 * they'll be reading).
 */
export function RecentRow({
  people,
  waiting = [],
  active = [],
  onPick,
  onDetails,
  title,
  max = 5,
  showLang = false,
  headRight,
}: {
  people: RecentPerson[];
  waiting?: Waiting[];
  active?: RecentPerson[];
  onPick: (p: RecentPerson, color: string) => void;
  onDetails: (p: RecentPerson, color: string) => void;
  title?: string;
  max?: number;
  showLang?: boolean;
  headRight?: React.ReactNode;
}) {
  const t = useT();
  const held = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <section className="recent" aria-label={title ?? t("recentTitle")}>
      <div className="recent-head">
        <h2>{title ?? t("recentTitle")}</h2>
        {headRight}
      </div>
      <div className="recent-list">
        {people.slice(0, max).map((p) => {
          const isWaiting = waiting.some((w) => w.person && samePerson(w.person.name, p.name));
          const isActive = !isWaiting && active.some((a) => samePerson(a.name, p.name));
          const color = colorFor(p.name);
          const sub = isWaiting ? t("waitingNow") : isActive ? t("activeNow") : when(p.at);
          return (
            <button
              key={p.name}
              className={`rp ${isWaiting ? "waiting" : ""} ${isActive ? "active" : ""}`}
              onPointerDown={() => {
                held.current = false;
                timer.current = setTimeout(() => {
                  held.current = true;
                  onDetails(p, color);
                }, 550);
              }}
              onPointerUp={() => timer.current && clearTimeout(timer.current)}
              onPointerLeave={() => timer.current && clearTimeout(timer.current)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!held.current) onDetails(p, color);
                held.current = true;
              }}
              onClick={() => {
                if (held.current) return void (held.current = false);
                onPick(p, color);
              }}
              aria-label={isWaiting ? t("waitingBanner", { name: p.name }) : t("callPerson", { name: p.name })}
            >
              <span className="rp-ring">
                <Avatar className="rp-av" photo={p.photo} fallback={initials(p.name)} style={{ background: color }} />
                {isActive && <span className="rp-dot" aria-hidden="true" />}
              </span>
              <span className="rp-text">
                <b>{p.name}</b>
                <small>{showLang ? `${languageName(p.lang)} · ${sub}` : sub}</small>
              </span>
              <span className="rp-call" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2.5" y="6" width="13" height="12" rx="3" />
                  <path d="M15.5 10.5 21 7.5v9l-5.5-3" />
                </svg>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Tap someone in Recent: who they are, and one button to call them again. */
export function PersonSheet({ person, color, link, onClose, onCalling, onRemoved }: { person: RecentPerson; color: string; link: string; onClose: () => void; onCalling: () => void; onRemoved: () => void }) {
  const t = useT();
  const [theirs, setTheirs] = useState<Strings | null>(null);
  const [reporting, setReporting] = useState(false);
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
    if (person.pair) return onCalling();
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

  if (reporting) return <ReportSheet name={person.name} onClose={onClose} onBlocked={onRemoved} />;
  return (
    <div className="bsheet-backdrop" onClick={onClose}>
      <div className="bsheet" role="dialog" aria-modal="true" aria-label={person.name} onClick={(e) => e.stopPropagation()}>
        <div className="bsheet-handle" aria-hidden="true" />
        <button ref={closeBtn} className="round-btn bsheet-close" aria-label={t("close")} onClick={onClose}>
          ×
        </button>
        <Avatar className="pc-av" photo={person.photo} fallback={initials(person.name)} style={{ background: color }} />
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
          <p className="pc-note">{person.pair ? t("callPairHint", { name: person.name }) : t("callPersonHint", { name: person.name })}</p>
          <button
            className="link pc-remove"
            onClick={() => {
              forgetRecent(person.name);
              onRemoved();
            }}
          >
            {t("removeRecent")}
          </button>
          <button className="link pc-remove" onClick={() => setReporting(true)}>
            {t("reportBlockShort")}
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
