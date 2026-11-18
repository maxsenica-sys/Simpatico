import type { SlangSet } from "./types";

export default {
  lang: "pl",
  groups: [
    {
      label: "Polish",
      lines: [
        '"spoko" = cool, fine',
        '"kurde", "kurczę" = damn',
        '"ziom" = bro',
        '"masakra" = a disaster or crazy',
        '"luz" = chill',
      ],
    },
  ],
  leftIn: ["kurde", "ziom", "znaczy", "właśnie"],
} satisfies SlangSet;
