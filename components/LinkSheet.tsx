"use client";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { canShareLink, shareLink } from "@/lib/native";
import { loadProfile } from "@/lib/profile";

/** "My call link": a bottom sheet with the QR code, Share / Copy, and Open my call room. */
export function LinkSheet({ url, onClose, onOpen }: { url: string; onClose: () => void; onOpen: () => void }) {
  const t = useT();
  const [svg, setSvg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const canShare = canShareLink();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0b0d10", light: "#ffffff" } }).then(setSvg).catch(() => {});
  }, [url]);
  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const share = () => {
    const name = loadProfile().name.trim().split(/\s+/)[0];
    void shareLink(url, name ? t("inviteText", { name }) : t("inviteTextAnon"));
  };

  return (
    <div className="bsheet-backdrop" onClick={onClose}>
      <div className="bsheet" role="dialog" aria-modal="true" aria-label={t("myLinkTitle")} onClick={(e) => e.stopPropagation()}>
        <div className="bsheet-handle" aria-hidden="true" />
        <button ref={closeBtn} className="round-btn bsheet-close" aria-label={t("close")} onClick={onClose}>
          ×
        </button>
        <h2>{t("myLinkTitle")}</h2>
        <p className="muted">{t("myLinkShort")}</p>
        <div className="bsheet-qr" role="img" aria-label={t("scanToJoin")} dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
        <p className="bsheet-url" dir="ltr">
          {url.replace(/^https?:\/\//, "")}
        </p>
        <div className="bsheet-actions">
          {canShare ? (
            <button className="btn primary big" onClick={share}>
              {t("share")}
            </button>
          ) : (
            <button className="btn primary big" onClick={() => void copy()}>
              {copied ? t("copied") : t("copyLink")}
            </button>
          )}
          {canShare && (
            <button className="btn big secondary" onClick={() => void copy()}>
              {copied ? t("copied") : t("copyLink")}
            </button>
          )}
          <button className="link" onClick={onOpen}>
            {t("myLinkOpen")} →
          </button>
        </div>
      </div>
    </div>
  );
}
