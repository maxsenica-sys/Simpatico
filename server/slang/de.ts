import type { SlangSet } from "./types";

export default {
  lang: "de",
  groups: [
    {
      label: "German",
      lines: [
        '"Alter", "Digga" = dude',
        '"krass" = crazy, intense',
        '"geil" = awesome',
        "\"na?\" = what's up?",
        '"Bock haben" = to feel like it',
        '"passt" = fine, works',
        '"Moin" = hi',
        '"Feierabend" = done for the day',
      ],
    },
  ],
  leftIn: ["naja", "na ja", "digga", "krass", "eben"],
} satisfies SlangSet;
