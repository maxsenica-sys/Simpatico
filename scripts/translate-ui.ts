// Machine-translates the English UI bundle (i18n/en.json) into every supported language and
// writes i18n/<code>.json, to be checked in. Hand-reviewed bundles are never overwritten.
//   ANTHROPIC_API_KEY=... npm run translate-ui            # only languages without a bundle
//   ANTHROPIC_API_KEY=... npm run translate-ui -- --force # regenerate all non-reviewed bundles
//   ANTHROPIC_API_KEY=... npm run translate-ui -- --only=ru,es
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { LANGUAGES } from "../shared/languages";

/** Where a language has major regional variants, the one its largest speaker group uses. */
const VARIANT: Record<string, string> = {
  pt: "Brazilian Portuguese (pt-BR), using você",
  zh: "Simplified Chinese (zh-CN)",
  es: "neutral Latin American Spanish, using tú",
  ar: "Modern Standard Arabic, friendly but not dialectal",
};

/** Bundles a native speaker has checked. Never regenerated. */
const REVIEWED = new Set(["en", "tr"]);
const force = process.argv.includes("--force");
const dir = new URL("../i18n/", import.meta.url);
const en = JSON.parse(readFileSync(new URL("en.json", dir), "utf8")) as Record<string, string>;
const keys = Object.keys(en);
const client = new Anthropic();

const SYSTEM =
  "You localise the interface of a consumer video-calling app. Translate each English string into natural, friendly, concise interface copy a native speaker would expect on their phone, using the informal register where the language has one. Keep {placeholders} exactly as they are. Keep typographic quotes and symbols such as ••• and ⋮. For iOS and Android menu paths and button names, use the names those systems show in that language. Keys starting with lbl are labels under small icon buttons: keep them to one or two short words.";

const schemaFor = (ks: string[]) => ({
  type: "object",
  properties: Object.fromEntries(ks.map((k) => [k, { type: "string" }])),
  required: ks,
  additionalProperties: false,
});

const load = (code: string): Record<string, string> | null => {
  const url = new URL(`${code}.json`, dir);
  return existsSync(url) ? (JSON.parse(readFileSync(url, "utf8")) as Record<string, string>) : null;
};

// --only=ru,es limits the run to those languages. Existing bundles only get their missing keys
// translated (with the existing strings as context, for consistent wording), unless --force.
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const plan = LANGUAGES.filter((l) => !REVIEWED.has(l.code) && (!only || only.includes(l.code)))
  .map((l) => {
    const existing = force ? null : load(l.code);
    const want = existing ? keys.filter((k) => !existing[k]) : keys;
    return { lang: l, existing, want };
  })
  .filter((p) => p.want.length);
console.log(`Translating UI: ${plan.map((p) => `${p.lang.code}(${p.want.length})`).join(" ") || "nothing to do"}`);

/** Structured output compiles the schema into a grammar; keep each request to a modest number of keys. */
const BATCH = 40;

async function translate(langLabel: string, want: string[], existing: Record<string, string> | null) {
  const source = Object.fromEntries(want.map((k) => [k, en[k]]));
  const context = existing
    ? `\n\nFor consistency, these strings are already translated in this app:\n${JSON.stringify(existing, null, 2)}`
    : "";
  const res = await client.messages.create({
    model: process.env.TRANSLATE_MODEL ?? "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { format: { type: "json_schema", schema: schemaFor(want) } },
    system: SYSTEM,
    messages: [{ role: "user", content: `Target language: ${langLabel}.${context}\n\nTranslate these:\n${JSON.stringify(source, null, 2)}` }],
  });
  if (res.stop_reason === "refusal") throw new Error("refused");
  return JSON.parse(res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("")) as Record<string, string>;
}

for (const { lang, existing, want } of plan) {
  const label = VARIANT[lang.code] ?? `${lang.name} (${lang.code})`;
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < want.length; i += BATCH) {
      Object.assign(out, await translate(label, want.slice(i, i + BATCH), { ...(existing ?? {}), ...out }));
    }
  } catch (err) {
    console.log(`  ${lang.code}: failed (${String(err).slice(0, 120)}), skipped`);
    continue;
  }
  const missing = want.filter((k) => typeof out[k] !== "string" || !out[k].trim());
  const badVars = want.filter((k) => (en[k].match(/\{\w+\}/g) ?? []).some((v) => !out[k]?.includes(v)));
  if (missing.length || badVars.length) {
    console.log(`  ${lang.code}: invalid (missing ${missing.join(",")} vars ${badVars.join(",")}), skipped`);
    continue;
  }
  const merged = Object.fromEntries(keys.map((k) => [k, out[k] ?? existing?.[k]]));
  writeFileSync(new URL(`${lang.code}.json`, dir), JSON.stringify(merged, null, 2) + "\n");
  console.log(`  ${lang.code}: ok (${want.length})`);
}
