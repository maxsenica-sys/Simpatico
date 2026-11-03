"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { langFromChoice } from "@/lib/prefs";
import { baseLang, langInfo } from "@/shared/lang";
import { LANGUAGES } from "@/shared/languages";
import { useLang } from "./LangRoot";

const SORTED = [...LANGUAGES].sort((a, b) => a.native.localeCompare(b.native));

/** The only place language is ever surfaced: one line, with a quiet "change". */
export function LanguageLine() {
  const t = useT();
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
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
          <span>{t("youSpeak", { lang: langInfo(lang.speaks).native })}</span>
          <span className="dot">·</span>
          <button className="link" onClick={() => setOpen(true)}>
            {t("change")}
          </button>
        </>
      )}
    </div>
  );
}
