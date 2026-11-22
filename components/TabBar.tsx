"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { loadProfile } from "@/lib/profile";
import { loadPhoto } from "@/lib/photo";
import { Avatar } from "./Avatar";

/**
 * The bar along the bottom: Home, the round Call button raised in the middle (the main thing the
 * app does, always in the same place, in reach of either thumb), and Me.
 */
export function TabBar({ active }: { active: "home" | "me" }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState("");
  useEffect(() => {
    setPhoto(loadPhoto());
    setName(loadProfile().name);
  }, []);
  const call = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/rooms?kind=pair", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const { code } = (await res.json()) as { code: string };
      router.push(`/r/${code}`);
    } catch {
      setBusy(false);
    }
  };
  const initial = name.trim().slice(0, 1).toUpperCase();
  return (
    <nav className="tabbar" aria-label={t("tabsLabel")}>
      <Link href="/" className={`tab ${active === "home" ? "on" : ""}`} aria-current={active === "home" ? "page" : undefined}>
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19z" />
        </svg>
        <span>{t("tabHome")}</span>
      </Link>
      <button className="tab-call" onClick={() => void call()} disabled={busy} aria-label={t("startCall")}>
        <span className="tab-call-circle" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="6" width="13" height="12" rx="3" />
            <path d="M15.5 10.5 21 7.5v9l-5.5-3" />
          </svg>
        </span>
        <span>{busy ? t("starting") : t("tabCall")}</span>
      </button>
      <Link href="/profile" className={`tab ${active === "me" ? "on" : ""}`} aria-label={t("openProfile")} aria-current={active === "me" ? "page" : undefined}>
        <Avatar className="avatar tab-avatar" photo={photo} fallback={
            initial || (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="8.5" r="4" />
                <path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
              </svg>
            )
          } />
        <span>{t("profileTitle")}</span>
      </Link>
    </nav>
  );
}
