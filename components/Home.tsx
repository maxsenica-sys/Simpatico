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

  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    setName(loadProfile().name);
    setMyLink(`${location.origin}/r/${myCallCode()}`);
    const env = detectEnv();
    if (env.ios && !env.standalone && !env.inApp && !env.nativeApp) setIosHint(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

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
    <main className="screen home2">
      <header className="home-top">
        <Logo small />
        <Link href="/profile" className="me-btn" aria-label={t("openProfile")}>
          <span className="avatar" aria-hidden="true">
            {initials(name) || <PersonIcon />}
          </span>
          <span className="me-label">{t("profileTitle")}</span>
        </Link>
      </header>

      <section className="home-hero">
        <h1 className="slogan">{t("slogan")}</h1>
      </section>

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
          <button className="htile" onClick={() => setShowLink(true)} disabled={!myLink}>
            <span className="htile-icon mint" aria-hidden="true">
              <LinkIcon />
            </span>
            <span className="htile-text">
              <b>{t("myLinkBtn")}</b>
              <small>{t("tileLinkSub")}</small>
            </span>
          </button>
        </div>
      </nav>

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
        <Link className="small" href="/privacy">
          {t("privacy")}
        </Link>
      </footer>

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

function LinkIcon() {
  return (
    <svg {...ICON}>
      <path d="M10 13.5a4.5 4.5 0 0 0 6.4.4l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" />
      <path d="M14 10.5a4.5 4.5 0 0 0-6.4-.4l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
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
