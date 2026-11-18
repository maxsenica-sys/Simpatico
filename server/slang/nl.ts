import type { SlangSet } from "./types";

export default {
  lang: "nl",
  groups: [
    {
      label: "Dutch",
      lines: [
        '"gezellig" = cosy, fun',
        '"lekker" = nice',
        '"joh" = man',
        '"toch?" = right?',
        '"doei" = bye',
        '"gaaf" = cool',
      ],
    },
  ],
  leftIn: ["gewoon", "eigenlijk", "joh"],
} satisfies SlangSet;
