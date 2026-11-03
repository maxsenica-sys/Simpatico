"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n";

export function ShareLink({ url, compact = false }: { url: string; compact?: boolean }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && !!navigator.share;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className={`share ${compact ? "compact" : ""}`}>
      {!compact && <div className="share-title">{t("shareTitle")}</div>}
      <div className="share-url" dir="ltr">{url.replace(/^https?:\/\//, "")}</div>
      <div className="share-actions">
        {canShare && (
          <button className="btn primary" onClick={() => navigator.share({ url }).catch(() => {})}>
            {t("share")}
          </button>
        )}
        <button className={`btn ${canShare ? "" : "primary"}`} onClick={copy}>
          {copied ? t("copied") : t("copyLink")}
        </button>
      </div>
    </div>
  );
}
