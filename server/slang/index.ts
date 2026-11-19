import { baseLang } from "../../shared/lang";
import af_ from "./af";
import ar_ from "./ar";
import az_ from "./az";
import be_ from "./be";
import bg_ from "./bg";
import bn_ from "./bn";
import bs_ from "./bs";
import ca_ from "./ca";
import cs_ from "./cs";
import cy_ from "./cy";
import da_ from "./da";
import de_ from "./de";
import el_ from "./el";
import en_ from "./en";
import es_ from "./es";
import et_ from "./et";
import eu_ from "./eu";
import fa_ from "./fa";
import fi_ from "./fi";
import fr_ from "./fr";
import gl_ from "./gl";
import gu_ from "./gu";
import he_ from "./he";
import hi_ from "./hi";
import hr_ from "./hr";
import hu_ from "./hu";
import id_ from "./id";
import it_ from "./it";
import ja_ from "./ja";
import kk_ from "./kk";
import kn_ from "./kn";
import ko_ from "./ko";
import lt_ from "./lt";
import lv_ from "./lv";
import mk_ from "./mk";
import ml_ from "./ml";
import mr_ from "./mr";
import ms_ from "./ms";
import nl_ from "./nl";
import no_ from "./no";
import pa_ from "./pa";
import pl_ from "./pl";
import pt_ from "./pt";
import ro_ from "./ro";
import ru_ from "./ru";
import sk_ from "./sk";
import sl_ from "./sl";
import sq_ from "./sq";
import sr_ from "./sr";
import sv_ from "./sv";
import sw_ from "./sw";
import ta_ from "./ta";
import te_ from "./te";
import th_ from "./th";
import tl_ from "./tl";
import tr_ from "./tr";
import uk_ from "./uk";
import ur_ from "./ur";
import vi_ from "./vi";
import zh_ from "./zh";
import type { SlangSet } from "./types";

/**
 * Per-call slang: the translator gets the reference for the call's two languages only (plus
 * shared rules), not all of them. Each language can then have a big list without making any
 * translation slower or dearer. Prompt caching still works: the block is the same for every
 * sentence between the same two languages.
 */
const SETS: Record<string, SlangSet> = Object.fromEntries([af_, ar_, az_, be_, bg_, bn_, bs_, ca_, cs_, cy_, da_, de_, el_, en_, es_, et_, eu_, fa_, fi_, fr_, gl_, gu_, he_, hi_, hr_, hu_, id_, it_, ja_, kk_, kn_, ko_, lt_, lv_, mk_, ml_, mr_, ms_, nl_, no_, pa_, pl_, pt_, ro_, ru_, sk_, sl_, sq_, sr_, sv_, sw_, ta_, te_, th_, tl_, tr_, uk_, ur_, vi_, zh_].map((s) => [s.lang, s]));
// Urdu shares the Hindi and Urdu list until it has its own.
if (!SETS.ur.groups.length) SETS.ur = SETS.hi;

const INTRO = "People on these calls talk casually: friends, families, teammates. Below are common slang words, particles and set phrases by language. They are examples, not a complete list. They are written in Latin letters here, but the transcript uses each language's own script, and speech recognition may spell them oddly. Read them by meaning, and when the target language has its own casual equivalent at the same register, use it.";
const ENGLISH_REGIONS = "English is spoken differently by region; <languages> may say which (Australia, United Kingdom, United States). The same word can differ: \"pissed\" = drunk (Australia, UK) but angry (US); \"pants\" = trousers (US) or underwear / rubbish (UK); \"thongs\" = flip-flops (Australia: \"grab your thongs\" is just \"grab your flip-flops\", nothing added); \"fanny pack\" vs \"bum bag\"; \"football\" = soccer (UK), American football (US); in Australia \"footy\" is AFL in most states and rugby league in New South Wales and Queensland, so it depends on context.";
const RULES = [
  "Rhymes, catchphrases and set phrases (\"see you later, alligator\", \"easy peasy lemon squeezy\", \"chillin' like a villain\", \"winner winner chicken dinner\") are translated by meaning and playfulness, not word for word; keep the playful tone if the target language has a similar phrase.",
  "Mixing languages in one sentence (Hinglish, Taglish, Turkish or Arabic with English words) is normal: translate the meaning of the whole. Politeness particles and fillers carry tone, not words.",
  "Terms of address (yaar, abi, habibi, dada, güey, kanka, frérot) become the target language's own (mate, bro, dear), not the original word, unless the listener's language uses it too.",
  "Sports talk (volleyball and others): keep the terms players of the target language really use; many are borrowed from English (\"spike\", \"set\", \"libero\", \"timeout\"), so use those rather than a literal translation."
];

/** Words speech recognition should expect in this language (see SlangSet.terms). */
export function slangTerms(lang: string): string[] {
  return SETS[baseLang(lang) ?? lang]?.terms ?? [];
}

/** Words of this language that must not be left in a translation out of it (see SlangSet.leftIn). */
export function leftInWords(lang: string): string[] {
  return SETS[baseLang(lang) ?? lang]?.leftIn ?? [];
}

/** Lines approved from real calls (vocab-extra.json), keyed by base language. */
export type Extra = Record<string, string[]>;

export function slangFor(sourceLang: string, targetLang: string, extra: Extra = {}): string {
  const codes = [...new Set([baseLang(sourceLang) ?? sourceLang, baseLang(targetLang) ?? targetLang])];
  const parts: string[] = [INTRO];
  if (codes.includes("en")) parts.push(ENGLISH_REGIONS);
  const seen = new Set<SlangSet>();
  // The speaker's language: how it is spoken (not how to write it). The listener's: only how to
  // write it ("Into Turkish…"). Half the text, so each call reads less.
  const writing = (label: string) => /^(into |out of )/i.test(label);
  const src = baseLang(sourceLang) ?? sourceLang;
  const tgt = baseLang(targetLang) ?? targetLang;
  for (const c of codes) {
    const set = SETS[c];
    if (!set || seen.has(set)) continue;
    seen.add(set);
    for (const g of set.groups) {
      const into = writing(g.label);
      if (src !== tgt && c === src && into) continue;
      if (src !== tgt && c === tgt && !(into && /^into /i.test(g.label))) continue;
      parts.push(`${g.label}: ${g.lines.join("; ")}.`);
    }
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
