"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n";
import { loadLang, saveLang, uiCode } from "@/lib/prefs";
import type { ParticipantLang } from "@/shared/lang";

type Ctx = { lang: ParticipantLang; setLang: (l: ParticipantLang) => void };
const LangCtx = createContext<Ctx | null>(null);

export function useLang() {
  const c = useContext(LangCtx);
  if (!c) throw new Error("useLang outside LangRoot");
  return c;
}

/** Reads (or detects and stores) this device's language once, then renders in it. */
export function LangRoot({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<ParticipantLang | null>(null);
  useEffect(() => {
    setLangState(loadLang());
  }, []);
  if (!lang) return <div className="boot" />;
  const setLang = (l: ParticipantLang) => {
    saveLang(l);
    setLangState(l);
  };
  return (
    <LangCtx.Provider value={{ lang, setLang }}>
      <I18nProvider code={uiCode(lang)}>{children}</I18nProvider>
    </LangCtx.Provider>
  );
}
