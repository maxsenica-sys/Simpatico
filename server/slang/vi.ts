import type { SlangSet } from "./types";

export default {
  lang: "vi",
  groups: [
    {
      label: "Vietnamese",
      lines: [
        '"ơi" calls someone ("Lan ơi" = hey Lan)',
        '"trời ơi" = oh my god',
        '"nha", "nhé" soften',
        '"anh", "em", "chị" are age-based I/you: translate as I/you',
      ],
    },
  ],
  leftIn: ["nha", "nhé", "nhỉ", "ơi"],
} satisfies SlangSet;
