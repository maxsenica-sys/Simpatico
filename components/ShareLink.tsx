"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

export function ShareLink({ url, compact = false, qr = false }: { url: string; compact?: boolean; /** Show the QR code straight away. */ qr?: boolean }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(qr);
  const [svg, setSvg] = useState<string | null>(null);
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  useEffect(() => {
    if (!showQr || svg) return;
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })
      .then(setSvg)
      .catch(() => setShowQr(false));
  }, [showQr, svg, url]);

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
      {showQr && svg && (
        <figure className="qr">
          {/* QR code of the call link, generated on the device. */}
          <div className="qr-code" role="img" aria-label={t("scanToJoin")} dangerouslySetInnerHTML={{ __html: svg }} />
          <figcaption className="muted small">{t("scanToJoin")}</figcaption>
        </figure>
      )}
      <div className="share-url" dir="ltr">
        {url.replace(/^https?:\/\//, "")}
      </div>
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
      <button className="link small qr-toggle" onClick={() => setShowQr((v) => !v)} aria-expanded={showQr}>
        {showQr ? t("hideQr") : t("showQr")}
      </button>
    </div>
  );
}
