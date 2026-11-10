/**
 * Turn "Not right?" reports into vocabulary, so the app keeps learning slang, names and phrases
 * from real calls without recording any. Nothing changes until a person approves it.
 *
 *   npx tsx scripts/review-reports.ts            # propose additions -> data/vocab-proposals.json
 *   npx tsx scripts/review-reports.ts --apply    # merge the proposals into data/vocab-extra.json
 *
 * On Fly: flyctl ssh console -C "sh -c 'cd /app && node_modules/.bin/tsx scripts/review-reports.ts'"
 * The server picks up vocab-extra.json within a minute (server/vocab.ts), no redeploy.
 */
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dataFile, recent } from "../server/store";
import type { VocabExtra } from "../server/vocab";

const EXTRA = dataFile("vocab-extra.json");
const PROPOSALS = dataFile("vocab-proposals.json");
const read = <T>(f: string, empty: T): T => (existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as T) : empty);

type Proposal = { lang: string; kind: "term" | "slang"; text: string; reason: string };
type Extra = VocabExtra & { reviewedUntil?: string };

if (process.argv.includes("--apply")) {
  const { additions } = read<{ additions: Proposal[] }>(PROPOSALS, { additions: [] });
  const extra = read<Extra>(EXTRA, {});
  let added = 0;
  for (const p of additions) {
    const bucket = p.kind === "term" ? (extra.terms ??= {}) : (extra.slang ??= {});
    const list = (bucket[p.lang] ??= []);
    if (!list.some((x) => x.toLowerCase() === p.text.toLowerCase())) {
      list.push(p.text);
      added++;
    }
  }
  extra.reviewedUntil = read<{ until?: string }>(PROPOSALS, {}).until ?? extra.reviewedUntil;
  writeFileSync(EXTRA, JSON.stringify(extra, null, 2));
  console.log(`Applied ${added} new entries to ${EXTRA}. Live within a minute.`);
  process.exit(0);
}

const extra = read<Extra>(EXTRA, {});
const reports = recent("reports", 500)
  .filter((r) => !extra.reviewedUntil || String(r.ts) > extra.reviewedUntil)
  .reverse();
if (!reports.length) {
  console.log("No new reports since the last review.");
  process.exit(0);
}

const client = new Anthropic();
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["additions"],
  properties: {
    additions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["lang", "kind", "text", "reason"],
        properties: {
          lang: { type: "string", description: "Base language code of the speech, e.g. en, tr, ru" },
          kind: { type: "string", enum: ["term", "slang"] },
          text: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;

const res = await client.messages.parse({
  model: "claude-opus-5-5",
  max_tokens: 16000,
  output_config: { effort: "high", format: jsonSchemaOutputFormat(schema) },
  system: `You improve a live video-call translator. People tap "Not right?" on captions they think are wrong. Each report has what speech recognition heard (source), the translation shown, and the languages.

For each report decide what, if anything, would have prevented the mistake:
- kind "term": a word or name speech recognition should know, spelled as it should be written (a person, character, brand, place, or a slang word it misheard). Only when the source looks misheard.
- kind "slang": a phrase the translator should understand, written as "phrase = meaning" (e.g. "flat out = very busy"), for slang, idioms or regional expressions it translated literally or wrongly.
Skip reports where the translation was actually fine, or the problem was something else (a cut-off sentence, noise). Never add anything sensitive or personal (no private names except well-known people or characters). Keep each entry short. Don't repeat entries already in the current additions.`,
  messages: [
    {
      role: "user",
      content: `<current_additions>${JSON.stringify({ terms: extra.terms ?? {}, slang: extra.slang ?? {} })}</current_additions>\n\n<reports>\n${reports
        .map((r) => JSON.stringify({ from: r.from, to: r.to, source: r.source, translation: r.translation }))
        .join("\n")}\n</reports>`,
    },
  ],
});

const additions = (res.parsed_output?.additions ?? []) as Proposal[];
writeFileSync(PROPOSALS, JSON.stringify({ until: String(reports.at(-1)!.ts), additions }, null, 2));
console.log(`${reports.length} reports reviewed, ${additions.length} proposed additions (saved to ${PROPOSALS}):\n`);
for (const a of additions) console.log(`  [${a.lang}] ${a.kind.padEnd(5)} ${a.text}\n          ${a.reason}`);
console.log(`\nIf these look right: npx tsx scripts/review-reports.ts --apply`);
