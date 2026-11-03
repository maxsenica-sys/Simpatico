import { LANGUAGES } from "./languages";

export type LangCode = (typeof LANGUAGES)[number]["code"];

/** Per-participant language settings. All values are BCP-47 tags, e.g. "en-AU", "tr-TR". */
export type ParticipantLang = {
  speaks: string;
  reads: string;
  ui: string;
};

const BY_CODE = new Map<string, (typeof LANGUAGES)[number]>(LANGUAGES.map((l) => [l.code, l]));

/** Aliases where the BCP-47 primary subtag differs from the code Soniox uses. */
const ALIASES: Record<string, string> = { nb: "no", nn: "no", fil: "tl", iw: "he", in: "id", zsm: "ms" };

/** Reduce any BCP-47 tag to a supported base code, or null if unsupported. */
export function baseLang(tag: string | undefined | null): LangCode | null {
  if (!tag) return null;
  const primary = tag.toLowerCase().split(/[-_]/)[0];
  const code = ALIASES[primary] ?? primary;
  return BY_CODE.has(code) ? (code as LangCode) : null;
}

export function isSupported(tag: string | undefined | null): boolean {
  return baseLang(tag) !== null;
}

export function langInfo(tag: string) {
  const b = baseLang(tag);
  return b ? BY_CODE.get(b)! : BY_CODE.get("en")!;
}

export function sameLanguage(a: string, b: string): boolean {
  return baseLang(a) === baseLang(b);
}

export function isRtl(tag: string): boolean {
  const info = langInfo(tag) as { rtl?: boolean };
  return !!info.rtl;
}

/** Validate an untrusted ParticipantLang (from the network) and fill defaults. */
export function sanitizeLang(input: unknown): ParticipantLang | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const tag = (v: unknown) => (typeof v === "string" && /^[A-Za-z]{2,3}([-_][A-Za-z0-9]{1,8})*$/.test(v) ? v : null);
  const speaks = tag(o.speaks);
  if (!speaks || !isSupported(speaks)) return null;
  const reads = tag(o.reads) && isSupported(tag(o.reads)) ? (o.reads as string) : speaks;
  const ui = tag(o.ui) ?? reads;
  return { speaks, reads, ui };
}
