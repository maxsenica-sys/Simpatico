"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { detectEnv } from "@/lib/env";
import { useT } from "@/lib/i18n";
import { loadProfile, myCallCode } from "@/lib/profile";
import { Logo } from "./Logo";
import { initials } from "./ProfileScreen";
import { LinkSheet } from "./LinkSheet";
import { Avatar } from "./Avatar";
import { loadPhoto } from "@/lib/photo";
import { followCards } from "@/lib/push";
import { PersonSheet, RecentRow } from "./Recent";
import { loadRecent, type RecentPerson } from "@/lib/recent";
import { usePresence } from "@/lib/waiting";
import { samePerson } from "@/lib/recent";
import { Splash } from "./Splash";

type InstallEvent = Event & { prompt: () => Promise<void> };

export function Home() {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [name, setName] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [myLink, setMyLink] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentPerson[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [person, setPerson] = useState<{ p: RecentPerson; color: string } | null>(null);

  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    setName(loadProfile().name);
    setMyLink(`${location.origin}/r/${myCallCode()}`);
    setRecent(loadRecent());
    setPhoto(loadPhoto());
    // Keep this phone following its own call card (only if notifications are already allowed).
    void followCards(t("waitingPush", { name: "{name}" }), { ask: false, extra: loadRecent().flatMap((r) => (r.pair ? [r.pair] : [])) });
    const env = detectEnv();
    if (env.ios && !env.standalone && !env.inApp && !env.nativeApp) setIosHint(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const { waiting, active } = usePresence(recent, name);
  const first = waiting[0];

  const start = async (kind: "pair" | "group") => {
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms?kind=${kind}`, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const { code } = (await res.json()) as { code: string };
      router.push(`/r/${code}`);
    } catch {
      setBusy(false);
    }
  };

  return (
    <main className={`screen home2 ${recent.length ? "has-recent" : ""} ${first ? "has-waiting" : ""}`}>
      <header className="home-top">
        <Logo small />
        <Link href="/profile" className="me-btn" aria-label={t("openProfile")}>
          <Avatar photo={photo} fallback={initials(name) || <PersonIcon />} />
          <span className="me-label">{t("profileTitle")}</span>
        </Link>
      </header>

      <section className="home-hero">
        <h1 className="slogan">{t("slogan")}</h1>
      </section>

      {first && (
        <button className="waiting-banner" onClick={() => router.push(`/r/${first.room}`)}>
          <span className="waiting-av">
            <Avatar photo={first.person?.photo} fallback={initials(first.name)} />
            <span className="live-dot" aria-hidden="true" />
          </span>
          <span className="waiting-text">
            <b>{waiting.length > 1 ? t("waitingMany", { name: first.name, n: String(waiting.length - 1) }) : t("waitingBanner", { name: first.name })}</b>
            <small>{t("waitingNow")}</small>
          </span>
          <span className="waiting-join">{t("joinNow")}</span>
        </button>
      )}

      <nav className="home-actions">
        <button className="htile primary" onClick={() => start("pair")} disabled={busy}>
          <span className="htile-icon" aria-hidden="true">
            <VideoIcon />
          </span>
          <span className="htile-text">
            <b>{busy ? t("starting") : t("startCall")}</b>
            <small>{t("tileCallSub")}</small>
          </span>
          <span className="htile-chev" aria-hidden="true">
            ›
          </span>
        </button>
        <div className="htile-row">
          <button className="htile" onClick={() => start("group")} disabled={busy}>
            <span className="htile-icon" aria-hidden="true">
              <PeopleIcon />
            </span>
            <span className="htile-text">
              <b>{t("startGroup")}</b>
              <small>{t("tileGroupSub")}</small>
            </span>
          </button>
          <button className="htile" onClick={() => router.push("/talk")}>
            <span className="htile-icon mint" aria-hidden="true">
              <FaceIcon />
            </span>
            <span className="htile-text">
              <b>{t("ipTile")}</b>
              <small>{t("ipTileSub")}</small>
            </span>
          </button>
        </div>
      </nav>

      {recent.length > 0 && (
        <RecentRow
          people={recent}
          waiting={waiting}
          active={active}
          onPick={(p, color) => {
            // Straight into a call with them: their waiting room, else our own room. Only people
            // from before this existed (no shared room yet) get the card with an invite.
            const w = waiting.find((x) => x.person && samePerson(x.person.name, p.name));
            if (w) router.push(`/r/${w.room}`);
            else if (p.pair) router.push(`/r/${p.pair}`);
            else setPerson({ p, color });
          }}
          onDetails={(p, color) => setPerson({ p, color })}
          headRight={
            <Link href="/contacts" className="all-contacts">
              {t("allContacts")} ›
            </Link>
          }
        />
      )}

      {/* The call card: shared once, so it's a slim row rather than a big button. */}
      <button className="card-row" onClick={() => setShowLink(true)} disabled={!myLink}>
        <span className="card-row-icon" aria-hidden="true">
          <CardIcon />
        </span>
        <span className="card-row-text">
          <b>{t("cardRowTitle")}</b> · {t("cardRowSub")}
        </span>
        <span className="card-row-share">{t("cardRowShare")}</span>
      </button>

      <footer className="home-foot">
        {install ? (
          <button
            className="link"
            onClick={() => {
              install.prompt();
              setInstall(null);
            }}
          >
            {t("install")}
          </button>
        ) : iosHint ? (
          <span className="muted small">{t("installIos")}</span>
        ) : null}
        {!name && !recent.length && (
          <Link className="small move-link" href="/profile#move">
            {t("moveNew")}
          </Link>
        )}
        <Link className="small" href="/privacy">
          {t("privacy")}
        </Link>
      </footer>

      {person && myLink && (
        <PersonSheet
          person={person.p}
          color={person.color}
          link={myLink}
          onClose={() => setPerson(null)}
          onCalling={() => router.push(person.p.pair ? `/r/${person.p.pair}` : new URL(myLink).pathname)}
          onRemoved={() => {
            setPerson(null);
            setRecent(loadRecent());
          }}
        />
      )}
      <Splash />
      {showLink && myLink && <LinkSheet url={myLink} onClose={() => setShowLink(false)} onOpen={() => router.push(new URL(myLink).pathname)} />}
    </main>
  );
}

const ICON = { viewBox: "0 0 24 24", width: 26, height: 26, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

function VideoIcon() {
  return (
    <svg {...ICON}>
      <rect x="2.5" y="6" width="13" height="12" rx="3" />
      <path d="M15.5 10.5 21 7.5v9l-5.5-3" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg {...ICON}>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M17.5 14c2.4.3 4 2.2 4 5" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg {...ICON}>
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <circle cx="8.5" cy="11" r="2.2" />
      <path d="M5.5 16c.6-1.5 1.7-2.3 3-2.3s2.4.8 3 2.3M14 10h4.5M14 13.5h3" />
    </svg>
  );
}

/** Two speech bubbles facing each other: a conversation across one phone. */
function FaceIcon() {
  return (
    <svg {...ICON}>
      <path d="M4.5 3.5h8a2 2 0 0 1 2 2V9a2 2 0 0 1-2 2H8.5l-3 2.5V11h-1a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2z" />
      <path d="M19.5 20.5h-8a2 2 0 0 1-2-2V15a2 2 0 0 1 2-2h4l3-2.5V13h1a2 2 0 0 1 2 2v3.5a2 2 0 0 1-2 2z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
