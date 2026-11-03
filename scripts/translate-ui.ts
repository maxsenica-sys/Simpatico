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

const schema = {
  type: "object",
  properties: Object.fromEntries(keys.map((k) => [k, { type: "string" }])),
  required: keys,
  additionalProperties: false,
};

// --only=ru,es limits the run to those languages.
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const todo = LANGUAGES.filter(
  (l) => !REVIEWED.has(l.code) && (!only || only.includes(l.code)) && (force || !existsSync(new URL(`${l.code}.json`, dir))),
);
console.log(`Translating UI into ${todo.length} languages…`);

for (const lang of todo) {
  const res = await client.messages.create({
    model: process.env.TRANSLATE_MODEL ?? "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { format: { type: "json_schema", schema } },
    system:
      "You localise the interface of a consumer video-calling app. Translate each English string into natural, friendly, concise interface copy a native speaker would expect on their phone, using the informal register where the language has one. Keep {placeholders} exactly as they are. Keep typographic quotes and symbols such as ••• and ⋮. For iOS and Android menu paths and button names, use the names those systems show in that language.",
    messages: [{ role: "user", content: `Target language: ${VARIANT[lang.code] ?? `${lang.name} (${lang.code})`}.\n\n${JSON.stringify(en, null, 2)}` }],
  });
  if (res.stop_reason === "refusal") {
    console.log(`  ${lang.code}: refused, skipped`);
    continue;
  }
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const out = JSON.parse(text) as Record<string, string>;
  const missing = keys.filter((k) => typeof out[k] !== "string" || !out[k].trim());
  const badVars = keys.filter((k) => (en[k].match(/\{\w+\}/g) ?? []).some((v) => !out[k]?.includes(v)));
  if (missing.length || badVars.length) {
    console.log(`  ${lang.code}: invalid (missing ${missing.join(",")} vars ${badVars.join(",")}), skipped`);
    continue;
  }
  writeFileSync(new URL(`${lang.code}.json`, dir), JSON.stringify(out, null, 2) + "\n");
  console.log(`  ${lang.code}: ok`);
}
