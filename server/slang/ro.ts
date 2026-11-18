import type { SlangSet } from "./types";

export default {
  lang: "ro",
  groups: [
    {
      label: "Romanian",
      lines: [
        '"frate" = bro',
        '"mișto" = cool',
        '"nasol" = bad',
        '"hai" = come on',
        '"las-o baltă" = forget it',
      ],
    },
  ],
  leftIn: ["bă", "mă", "adică", "deci", "păi"],
} satisfies SlangSet;
