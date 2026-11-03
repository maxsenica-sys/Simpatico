import en from "./en.json";

export type StringKey = keyof typeof en;
export type Strings = Record<StringKey, string>;
export { en };

/**
 * Loads the UI bundle for a base language code. Bundles are generated at build time by
 * scripts/translate-ui.ts and checked in; any missing bundle or key falls back to English.
 */
export async function loadStrings(code: string): Promise<Strings> {
  if (code === "en") return en;
  try {
    const mod = (await import(`./${code}.json`)) as { default: Partial<Strings> };
    return { ...en, ...mod.default };
  } catch {
    return en;
  }
}
