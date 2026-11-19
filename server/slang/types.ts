/**
 * Slang, particles and set phrases for one spoken language. Each call's translator only gets
 * the sets for the languages actually in that call (plus shared rules), so each language can
 * have a big list without slowing anyone down.
 *
 * A line: `"term", "variant" = meaning (note)`. Real, current, widely used words only, with
 * the meaning a listener needs. Regional and vulgar use is noted in brackets.
 */
export type SlangGroup = {
  /** Shown to the translator as the heading, e.g. "English, Australian". */
  label: string;
  lines: string[];
};

export type SlangSet = {
  /** Base language code (BCP-47 primary subtag), e.g. "en", "tr". */
  lang: string;
  groups: SlangGroup[];
  /**
   * Fillers, particles and terms of address that must never be left in a translation OUT of
   * this language (checked after each translation; one corrective retry). Only words that are
   * not also ordinary words in other languages written with the same letters.
   */
  leftIn?: string[];
  /**
   * Words speech recognition should expect in this language (slang, clipped forms, names,
   * places, food), sent to Soniox as hints when a stream opens. Real, common words only.
   */
  terms?: string[];
};
