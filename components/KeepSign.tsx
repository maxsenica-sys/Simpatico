"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { RECOVERY_DAYS, keepsTalks, setKeepTalks } from "@/lib/saved";

/**
 * Before a call or an In person conversation starts: one small green line saying it will be
 * kept on this phone, and a tiny switch under it to turn that off or on. Off still leaves the
 * recovery copy, so the line says when that goes. The same setting as
 * "Keep my conversations on this phone" on the Me page.
 */
export function KeepSign() {
  const t = useT();
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => setOn(keepsTalks()), []);
  if (on === null) return null;
  return (
    <div className={`keep-sign ${on ? "on" : ""}`}>
      <span className="keep-line">
        <i aria-hidden="true" />
        {on ? t("keepSignOn") : t("keepSignOff", { n: String(RECOVERY_DAYS) })}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="switch mini"
        aria-label={t("keepTalks")}
        checked={on}
        onChange={(e) => {
          setKeepTalks(e.target.checked);
          setOn(e.target.checked);
        }}
      />
    </div>
  );
}
