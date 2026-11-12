import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaJSONSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { baseLang, langInfo } from "../shared/lang";
import { log } from "./log";
import { SEED } from "./phrasebook-seed";
import { dataFile, recent } from "./store";

/**
 * The phrasebook: set phrases, idioms and current expressions that go wrong word for word
 * ("tick all the boxes", "you'll pull through"), each with what people really say for it in the
 * other languages. Unlike the slang list (always sent), an entry only goes to the translator
 * when its words were just said, so the phrasebook can grow every day without slowing anything.
 *
 * A daily job on the server writes new entries for each language with Claude Opus, has a second
 * pass check them, and adds the ones that survive (/data/phrasebook.json). Nothing from calls
 * is used except sentences people chose to report with "Not right?".
 */
export type Phrase = {
  lang: string;
  phrase: string;
  /** Word beginnings (one word) or exact word sequences (several words) that are always said. */
  match: string[];
  /** Plain English meaning. */
  meaning: string;
  /** What people really say for it, by base language. */
  eq: Record<string, string>;
  source: "seed" | "daily";
  added?: string;
};

/** The app's languages: the daily job covers these, and each entry gets equivalents in all. */
export const PHRASEBOOK_LANGS = ["en", "tr", "es", "pt", "fr", "ru", "ar", "hi", "ur", "bn", "zh", "id"];
const PER_DAY = 15;
const MAX_PER_LANG = 5000;
const MAX_IN_PROMPT = 6;

type Saved = { entries: Phrase[]; lastRun?: string };
const FILE = () => dataFile("phrasebook.json");
let saved: Saved | null = null;
let byLang = new Map<string, Phrase[]>();

function load(): Saved {
  if (saved) return saved;
  saved = { entries: [] };
  try {
    if (existsSync(FILE())) saved = JSON.parse(readFileSync(FILE(), "utf8")) as Saved;
  } catch (err) {
    log("phrasebook_load_failed", { error: String(err) });
  }
  index();
  return saved;
}

function index() {
  byLang = new Map();
  for (const p of [...SEED, ...(saved?.entries ?? [])]) {
    const list = byLang.get(p.lang) ?? [];
    list.push(p);
    byLang.set(p.lang, list);
  }
}

/** Lower case, no apostrophes or punctuation, single spaces (Turkish İ/ı handled). */
export function norm(text: string, lang: string): string {
  return ` ${text
    .toLocaleLowerCase(lang === "tr" ? "tr" : undefined)
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()} `;
}

const NO_SPACES = new Set(["zh", "ja", "th"]);

/** Entries whose words were all said in `text`. */
export function phrasesIn(text: string, sourceLang: string): Phrase[] {
  load();
  const lang = baseLang(sourceLang) ?? sourceLang;
  const list = byLang.get(lang === "ur" ? "ur" : lang) ?? [];
  if (!list.length) return [];
  const t = norm(text, lang);
  const found: Phrase[] = [];
  for (const p of list) {
    const hit = p.match.every((m) => m.split("|").some((alt) => said(t, alt, lang)));
    if (hit && !found.some((f) => f.phrase === p.phrase)) found.push(p);
    if (found.length >= MAX_IN_PROMPT) break;
  }
  return found;
}

/** For the translator: the phrases just said, with their meaning and the target-language equivalent. */
export function phrasebookTag(text: string, sourceLang: string, targetLang: string): string {
  const hits = phrasesIn(text, sourceLang);
  if (!hits.length) return "";
  const tgt = baseLang(targetLang) ?? targetLang;
  const lines = hits.map((p) => `"${p.phrase}" = ${p.meaning}${p.eq[tgt] ? `; people say: "${p.eq[tgt]}"` : ""}`);
  return `<phrasebook>\n${lines.join("\n")}\n</phrasebook>`;
}

export function phrasebookSize(): Record<string, number> {
  load();
  return Object.fromEntries([...byLang.entries()].map(([l, v]) => [l, v.length]));
}

// ------------------------------------------------------------------ daily job

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["entries"],
  properties: {
    entries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["phrase", "match", "meaning", "eq"],
        properties: {
          phrase: { type: "string" },
          match: { type: "array", items: { type: "string" } },
          meaning: { type: "string" },
          eq: {
            type: "object",
            additionalProperties: false,
            required: PHRASEBOOK_LANGS as readonly string[],
            properties: Object.fromEntries(PHRASEBOOK_LANGS.map((l) => [l, { type: "string" as const }])) as Record<string, { type: "string" }>,
          },
        },
      },
    },
  },
} as const;

type Draft = { phrase: string; match: string[]; meaning: string; eq: Record<string, string> };

const RULES = `Each entry:
- phrase: as people actually say it, in its usual spelling and script.
- match: 1 to 3 items that are ALWAYS present whenever someone says it, however it is inflected: either a single word beginning (lower case, at least 3 letters, e.g. "tick", "box" for "tick all the boxes") or a run of words that never changes, whose last word may be just its beginning (e.g. "pull through", "kafa dağıt"). Distinctive enough that ordinary sentences don't match. For Chinese, items are exact character sequences.
- meaning: plain English, short.
- eq: for EVERY language code listed, what a native speaker would naturally say in that situation: a matching idiom or common expression where one exists, otherwise short natural wording. For the phrase's own language, repeat the phrase.
Only real, current, widely used expressions; never invent one; nothing you are unsure of. No slurs. Skip anything already in <existing>.`;

async function draftFor(client: Anthropic, lang: string, existing: string[], mistakes: string[]): Promise<Draft[]> {
  const name = langInfo(lang).name;
  const langs = PHRASEBOOK_LANGS.map((l) => `${l} = ${langInfo(l).name}`).join(", ");
  const ask = async (system: string, user: string): Promise<Draft[]> => {
    const res = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: betaJSONSchemaOutputFormat(schema) },
      system,
      messages: [{ role: "user", content: user }],
    });
    if (res.stop_reason === "refusal") return [];
    return (res.parsed_output?.entries ?? []) as Draft[];
  };
  const context = `<language>${lang} = ${name}</language>\n<languages_for_eq>${langs}</languages_for_eq>\n<existing>${existing.slice(-600).join(" | ")}</existing>${mistakes.length ? `\n<recent_mistakes>\n${mistakes.join("\n")}\n</recent_mistakes>` : ""}`;
  const drafts = await ask(
    `You add to the phrasebook of a live video-call translator. People on calls talk casually: friends, couples, families. Write ${PER_DAY} new entries for ${name}: everyday spoken phrases, idioms, set expressions, and current expressions people really use in conversation, where a word-for-word translation goes wrong. Mix well-known staples with expressions in fashion now. If <recent_mistakes> shows phrases the translator got wrong, cover those first.\n\n${RULES}`,
    context,
  );
  if (!drafts.length) return [];
  // Second pass: a fresh check of every entry. Wrong entries are worse than missing ones.
  return ask(
    `You check entries for the phrasebook of a live video-call translator before they go live. Keep an entry only if the phrase is real, current and widely used in ${name}, the meaning is right, and every equivalent is what a native speaker would naturally say. Fix small mistakes in equivalents and match items (match items must always be present when the phrase is said, and must not match ordinary sentences). Drop any entry you are not sure of. Return the kept entries.\n\n${RULES}`,
    `${context}\n<entries_to_check>${JSON.stringify(drafts)}</entries_to_check>`,
  );
}

function valid(d: Draft, lang: string): boolean {
  return (
    typeof d.phrase === "string" && d.phrase.length >= 3 && d.phrase.length <= 80 &&
    Array.isArray(d.match) && d.match.length >= 1 && d.match.length <= 3 &&
    d.match.every((m) => typeof m === "string" && norm(m, lang).trim().length >= (NO_SPACES.has(lang) ? 2 : 3)) &&
    typeof d.meaning === "string" && d.meaning.length <= 200 &&
    // The phrase itself must contain what it matches on.
    phrasesInOne(d, lang)
  );
}

function phrasesInOne(d: Draft, lang: string): boolean {
  const t = norm(d.phrase, lang);
  return d.match.every((m) => m.split("|").some((alt) => said(t, alt, lang)));
}

/** Is match item `m` (a word beginning, or an exact run of words) in normalised text `t`? */
function said(t: string, m: string, lang: string): boolean {
  const n = norm(m, lang).trim();
  if (!n) return false;
  if (NO_SPACES.has(lang)) return t.includes(n);
  // Whole words, except the last may carry endings (Turkish "rahatla" -> "rahatladı").
  return t.includes(` ${n}`);
}

let running = false;

/** One day's additions for every language. Safe to call any time; one run at a time. */
export async function growPhrasebook(): Promise<number> {
  if (running) return 0;
  running = true;
  const data = load();
  const client = new Anthropic();
  let total = 0;
  try {
    const reports = recent("reports", 300);
    for (const lang of PHRASEBOOK_LANGS) {
      try {
        const have = byLang.get(lang) ?? [];
        if (have.length >= MAX_PER_LANG) continue;
        const known = new Set(have.map((p) => norm(p.phrase, lang).trim()));
        const mistakes = reports
          .filter((r) => baseLang(String(r.from ?? "")) === lang)
          .slice(0, 20)
          .map((r) => `${r.source} -> ${r.translation}`);
        const drafts = await draftFor(client, lang, have.map((p) => p.phrase), mistakes);
        const today = new Date().toISOString().slice(0, 10);
        let added = 0;
        for (const d of drafts) {
          if (!valid(d, lang) || known.has(norm(d.phrase, lang).trim())) continue;
          known.add(norm(d.phrase, lang).trim());
          const eq = Object.fromEntries(Object.entries(d.eq).filter(([l, v]) => l !== lang && typeof v === "string" && v.trim() && v.length <= 160));
          data.entries.push({ lang, phrase: d.phrase.trim(), match: d.match.map((m) => m.trim()), meaning: d.meaning.trim(), eq, source: "daily", added: today });
          added++;
        }
        total += added;
        log("phrasebook_added", { lang, added, drafted: drafts.length });
        index();
      } catch (err) {
        log("phrasebook_lang_failed", { lang, error: err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : String(err) });
      }
    }
    data.lastRun = new Date().toISOString();
    mkdirSync(dirname(FILE()), { recursive: true });
    await writeFile(FILE() + ".tmp", JSON.stringify(data));
    await rename(FILE() + ".tmp", FILE());
    log("phrasebook_run", { added: total, size: phrasebookSize() });
  } finally {
    running = false;
  }
  return total;
}

/**
 * Runs the daily job about once a day while the server is up (checked hourly; first check 10
 * minutes after start). Off in tests and when there's no translator key.
 */
export function startPhrasebookSchedule() {
  if (process.env.NODE_ENV !== "production" || process.env.ANTHROPIC_BASE_URL || !process.env.ANTHROPIC_API_KEY || process.env.PHRASEBOOK_DAILY === "off") return;
  const tick = () => {
    const last = Date.parse(load().lastRun ?? "") || 0;
    if (Date.now() - last > 23 * 3600_000) void growPhrasebook().catch((err) => log("phrasebook_failed", { error: String(err) }));
  };
  setTimeout(tick, 10 * 60_000);
  setInterval(tick, 3600_000).unref();
}
