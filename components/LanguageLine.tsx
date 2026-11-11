"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { langFromChoice } from "@/lib/prefs";
import { loadProfile } from "@/lib/profile";
import { baseLang, langInfo } from "@/shared/lang";
import { LANGUAGES } from "@/shared/languages";
import { useLang } from "./LangRoot";

const SORTED = [...LANGUAGES].sort((a, b) => a.native.localeCompare(b.native));

/**
 * The language's name as written mid-sentence in the UI language ("español", "русский",
 * but "Türkçe", "English"). Falls back to the list's autonym when the browser's name
 * differs from it by more than letter case (e.g. "Indonesia" vs "Bahasa Indonesia").
 */
function inlineName(code: string, ui: string, native: string): string {
  try {
    const name = new Intl.DisplayNames([ui], { type: "language" }).of(code);
    if (name && name.toLocaleLowerCase(ui) === native.toLocaleLowerCase(ui)) return name;
  } catch {}
  return native;
}

/** "Australian English", "español de México": only when the browser has a name for the pair. */
function regionalName(code: string, region: string, ui: string): string | null {
  try {
    const name = new Intl.DisplayNames([ui], { type: "language", fallback: "none" }).of(`${code}-${region}`);
    return name && !name.includes("(") ? name : null;
  } catch {
    return null;
  }
}

/** The only place language is ever surfaced: one line, with a quiet "change". */
export function LanguageLine() {
  const t = useT();
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  // Where you're from ("Me") gives the variety: "Australian English".
  const [from, setFrom] = useState<string | null>(null);
  useEffect(() => setFrom(loadProfile().from), []);
  const current = baseLang(lang.speaks) ?? "en";
  return (
    <div className="langline">
      {open ? (
        <select
          autoFocus
          className="langselect"
          value={current}
          onChange={(e) => {
            setLang(langFromChoice(e.target.value));
            setOpen(false);
          }}
          onBlur={() => setOpen(false)}
        >
          {SORTED.map((l) => (
            <option key={l.code} value={l.code}>
              {l.native}
            </option>
          ))}
        </select>
      ) : (
        <>
          <span>{t("youSpeak", { lang: (from && regionalName(current, from, baseLang(lang.ui) ?? current)) || inlineName(current, baseLang(lang.ui) ?? current, langInfo(lang.speaks).native) })}</span>
          <span className="dot">·</span>
          <button className="link" onClick={() => setOpen(true)}>
            {t("change")}
          </button>
        </>
      )}
    </div>
  );
}
