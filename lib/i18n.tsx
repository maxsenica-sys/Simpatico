"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { en, loadStrings, type StringKey, type Strings } from "@/i18n";
import { isRtl } from "@/shared/lang";

const Ctx = createContext<Strings>(en);

export function I18nProvider({ code, children }: { code: string; children: ReactNode }) {
  const [strings, setStrings] = useState<Strings | null>(code === "en" ? en : null);
  useEffect(() => {
    let live = true;
    loadStrings(code).then((s) => live && setStrings(s));
    document.documentElement.lang = code;
    document.documentElement.dir = isRtl(code) ? "rtl" : "ltr";
    return () => {
      live = false;
    };
  }, [code]);
  // Render nothing until the bundle is in, so a Turkish phone never flashes English.
  if (!strings) return null;
  return <Ctx.Provider value={strings}>{children}</Ctx.Provider>;
}

export function useT() {
  const s = useContext(Ctx);
  return (key: StringKey, vars?: Record<string, string>) =>
    (s[key] ?? en[key]).replace(/\{(\w+)\}/g, (_, k: string) => vars?.[k] ?? "");
}
