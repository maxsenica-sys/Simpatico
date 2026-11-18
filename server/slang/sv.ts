import type { SlangSet } from "./types";

export default {
  lang: "sv",
  groups: [
    {
      label: "Swedish",
      lines: [
        '"typ" = like',
        '"asså" = I mean, like',
        '"fika" = coffee break',
        '"lagom" = just right',
        '"schysst" = nice',
      ],
    },
  ],
  leftIn: ["alltså", "liksom", "väl"],
} satisfies SlangSet;
