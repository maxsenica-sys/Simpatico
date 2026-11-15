"use client";
import type { CaptionPrefs, CaptionSize } from "@/lib/captionPrefs";
import { useT } from "@/lib/i18n";
import { hasMicModes, showMicModes } from "@/lib/native";

const SIZES: CaptionSize[] = ["s", "m", "l", "xl"];

/** Caption style, size, voice focus and background: in the call (transcript panel) and in "Me". */
export function CaptionSettings({
  prefs,
  onPrefs,
}: {
  prefs: CaptionPrefs;
  onPrefs: (p: CaptionPrefs) => void;
}) {
  const t = useT();
  return (
    <>
      <div className="seg" role="radiogroup" aria-label={t("captionStyle")}>
        <span className="muted small">{t("captionStyle")}</span>
        {(["instant", "steady"] as const).map((st) => (
          <button
            key={st}
            role="radio"
            aria-checked={prefs.style === st}
            className={`seg-btn wide ${prefs.style === st ? "on" : ""}`}
            onClick={() => onPrefs({ ...prefs, style: st, styleSet: true })}
          >
            {t(st === "steady" ? "styleSteady" : "styleInstant")}
          </button>
        ))}
      </div>
      <p className="muted small style-hint">
        {t(prefs.style === "steady" ? "styleSteadyHint" : "styleInstantHint")}
      </p>
      <div className="seg" role="radiogroup" aria-label={t("longSpeech")}>
        <span className="muted small">{t("longSpeech")}</span>
        {(["room", "scroll"] as const).map((l) => (
          <button key={l} role="radio" aria-checked={prefs.long === l} className={`seg-btn wide ${prefs.long === l ? "on" : ""}`} onClick={() => onPrefs({ ...prefs, long: l })}>
            {t(l === "scroll" ? "longScroll" : "longRoom")}
          </button>
        ))}
      </div>
      <p className="muted small style-hint">{t(prefs.long === "scroll" ? "longScrollHint" : "longRoomHint")}</p>
      <div className="seg" role="radiogroup" aria-label={t("captionSize")}>
        <span className="muted small">{t("captionSize")}</span>
        {SIZES.map((s, i) => (
          <button
            key={s}
            role="radio"
            aria-checked={prefs.size === s}
            className={`seg-btn ${prefs.size === s ? "on" : ""}`}
            style={{ fontSize: `${0.8 + i * 0.18}rem` }}
            onClick={() => onPrefs({ ...prefs, size: s })}
          >
            A
          </button>
        ))}
      </div>
      <button
        role="switch"
        aria-checked={prefs.focus}
        className={`seg-btn wide ${prefs.focus ? "on" : ""}`}
        onClick={() => onPrefs({ ...prefs, focus: !prefs.focus })}
      >
        {t("voiceFocus")}
      </button>
      <p className="muted small style-hint">{t("voiceFocusHint")}</p>
      {hasMicModes() && (
        <button className="btn small" onClick={() => void showMicModes()}>
          {t("micModes")}
        </button>
      )}
      <button
        role="switch"
        aria-checked={prefs.box}
        className={`seg-btn wide ${prefs.box ? "on" : ""}`}
        onClick={() => onPrefs({ ...prefs, box: !prefs.box })}
      >
        {t("captionBox")}
      </button>
      <p className="muted small kbd-hint">{t("shortcuts")}</p>
    </>
  );
}
