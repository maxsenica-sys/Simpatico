"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { canShareLink, shareLink } from "@/lib/native";
import { loadProfile } from "@/lib/profile";

export function ShareLink({
  url,
  compact = false,
  qr = false,
  caption,
  hideUrl = false,
  invite = true,
}: {
  url: string;
  compact?: boolean;
  /** Show the QR code straight away. */
  qr?: boolean;
  /** Under the QR code (default: "Scan to join"). */
  caption?: string;
  /** Don't print the link (long links, e.g. a profile transfer). */
  hideUrl?: boolean;
  /** Share with a friendly invitation in front of the link (call links). */
  invite?: boolean;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(qr);
  const [svg, setSvg] = useState<string | null>(null);
  const canShare = canShareLink();

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
    <div className={`share ${compact ? "compact" : ""}`} data-url={url}>
      {!compact && <div className="share-title">{t("shareTitle")}</div>}
      {showQr && svg && (
        <figure className="qr">
          {/* QR code of the call link, generated on the device. */}
          <div className="qr-code" role="img" aria-label={caption ?? t("scanToJoin")} dangerouslySetInnerHTML={{ __html: svg }} />
          <figcaption className="muted small">{caption ?? t("scanToJoin")}</figcaption>
        </figure>
      )}
      {!hideUrl && (
        <div className="share-url" dir="ltr">
          {url.replace(/^https?:\/\//, "")}
        </div>
      )}
      <div className="share-actions">
        {canShare && (
          <button className="btn primary" onClick={() => {
              const name = loadProfile().name.trim().split(/\s+/)[0];
              void shareLink(url, invite ? (name ? t("inviteText", { name }) : t("inviteTextAnon")) : undefined);
            }}>
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
