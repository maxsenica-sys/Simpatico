"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { detectEnv } from "@/lib/env";
import { useT } from "@/lib/i18n";
import { loadProfile } from "@/lib/profile";
import { Logo } from "./Logo";
import { initials } from "./ProfileScreen";

type InstallEvent = Event & { prompt: () => Promise<void> };

export function Home() {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    setName(loadProfile().name);
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
    <main className="screen center home">
      <Link href="/profile" className="me-btn" aria-label={t("openProfile")}>
        <span className="avatar" aria-hidden="true">
          {initials(name) || <PersonIcon />}
        </span>
        <span className="me-label">{t("profileTitle")}</span>
      </Link>
      <div className="hero">
        <Logo />
        {name && <p className="hello">{t("hiName", { name: name.split(/\s+/)[0] })}</p>}
        <h1 className="slogan">{t("slogan")}</h1>
        <button className="btn primary big" onClick={() => start("pair")} disabled={busy}>
          {busy ? t("starting") : t("startCall")}
        </button>
        <button className="btn big secondary" onClick={() => start("group")} disabled={busy}>
          {t("startGroup")}
        </button>
      </div>
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
        <div className="small" style={{ marginTop: 10 }}>
          <Link href="/privacy">{t("privacy")}</Link>
        </div>
      </footer>
    </main>
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
