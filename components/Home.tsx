"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { detectEnv } from "@/lib/env";
import { useT } from "@/lib/i18n";
import { Logo } from "./Logo";

type InstallEvent = Event & { prompt: () => Promise<void> };

export function Home() {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    const env = detectEnv();
    if (env.ios && !env.standalone && !env.inApp) setIosHint(true);
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
      <div className="hero">
        <Logo />
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
