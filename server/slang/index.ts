import { baseLang } from "../../shared/lang";
import ar_ from "./ar";
import bn_ from "./bn";
import cs_ from "./cs";
import de_ from "./de";
import el_ from "./el";
import en_ from "./en";
import es_ from "./es";
import fa_ from "./fa";
import fr_ from "./fr";
import he_ from "./he";
import hi_ from "./hi";
import hu_ from "./hu";
import id_ from "./id";
import it_ from "./it";
import ja_ from "./ja";
import ko_ from "./ko";
import ms_ from "./ms";
import nl_ from "./nl";
import pl_ from "./pl";
import pt_ from "./pt";
import ro_ from "./ro";
import ru_ from "./ru";
import sv_ from "./sv";
import sw_ from "./sw";
import th_ from "./th";
import tl_ from "./tl";
import tr_ from "./tr";
import uk_ from "./uk";
import vi_ from "./vi";
import zh_ from "./zh";
import type { SlangSet } from "./types";

/**
 * Per-call slang: the translator gets the reference for the call's two languages only (plus
 * shared rules), not all of them. Each language can then have a big list without making any
 * translation slower or dearer. Prompt caching still works: the block is the same for every
 * sentence between the same two languages.
 */
const SETS: Record<string, SlangSet> = Object.fromEntries([ar_, bn_, cs_, de_, el_, en_, es_, fa_, fr_, he_, hi_, hu_, id_, it_, ja_, ko_, ms_, nl_, pl_, pt_, ro_, ru_, sv_, sw_, th_, tl_, tr_, uk_, vi_, zh_].map((s) => [s.lang, s]));
// Urdu shares the Hindi and Urdu list.
SETS.ur = SETS.hi;

const INTRO = "People on these calls talk casually: friends, families, teammates. Below are common slang words, particles and set phrases by language. They are examples, not a complete list. They are written in Latin letters here, but the transcript uses each language's own script, and speech recognition may spell them oddly. Read them by meaning, and when the target language has its own casual equivalent at the same register, use it.";
const ENGLISH_REGIONS = "English is spoken differently by region; <languages> may say which (Australia, United Kingdom, United States). The same word can differ: \"pissed\" = drunk (Australia, UK) but angry (US); \"pants\" = trousers (US) or underwear / rubbish (UK); \"thongs\" = flip-flops (Australia: \"grab your thongs\" is just \"grab your flip-flops\", nothing added); \"fanny pack\" vs \"bum bag\"; \"football\" = soccer (UK), American football (US); in Australia \"footy\" is AFL in most states and rugby league in New South Wales and Queensland, so it depends on context.";
const RULES = [
  "Rhymes, catchphrases and set phrases (\"see you later, alligator\", \"easy peasy lemon squeezy\", \"chillin' like a villain\", \"winner winner chicken dinner\") are translated by meaning and playfulness, not word for word; keep the playful tone if the target language has a similar phrase.",
  "Mixing languages in one sentence (Hinglish, Taglish, Turkish or Arabic with English words) is normal: translate the meaning of the whole. Politeness particles and fillers carry tone, not words.",
  "Terms of address (yaar, abi, habibi, dada, güey, kanka, frérot) become the target language's own (mate, bro, dear), not the original word, unless the listener's language uses it too.",
  "Sports talk (volleyball and others): keep the terms players of the target language really use; many are borrowed from English (\"spike\", \"set\", \"libero\", \"timeout\"), so use those rather than a literal translation."
];

/** Lines approved from real calls (vocab-extra.json), keyed by base language. */
export type Extra = Record<string, string[]>;

export function slangFor(sourceLang: string, targetLang: string, extra: Extra = {}): string {
  const codes = [...new Set([baseLang(sourceLang) ?? sourceLang, baseLang(targetLang) ?? targetLang])];
  const parts: string[] = [INTRO];
  if (codes.includes("en")) parts.push(ENGLISH_REGIONS);
  const seen = new Set<SlangSet>();
  for (const c of codes) {
    const set = SETS[c];
    if (!set || seen.has(set)) continue;
    seen.add(set);
    for (const g of set.groups) parts.push(`${g.label}: ${g.lines.join("; ")}.`);
  }
  const added = codes.flatMap((c) => (extra[c] ?? []).map((l) => `${c}: ${l}`));
  if (added.length) parts.push(`Added from real calls:\n${added.join("\n")}`);
  parts.push(...RULES);
  parts.push("Regional words and shortenings (servo, arvo, brekkie, kanka) become the listener's own everyday word (petrol station, afternoon, breakfast, mate), not kept as they are; brand names (Tim Tam, Maccas) stay.");
  parts.push("This reference is only for understanding. The reply is the subtitle alone: never explain a word, never mention this list, never correct yourself in the reply.");
  return `<spoken_language_reference>\n${parts.join("\n")}\n</spoken_language_reference>`;
}

/** Every language with a list (for tests and the admin page). */
export function slangLanguages(): string[] {
  return Object.keys(SETS);
}
