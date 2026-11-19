# Swahili (sw): langeval notes

3 valid runs (one more run hit the Fly rate limit, see below). `server/slang/sw.ts` had 5 lines; it now has 8 groups (about 23 KB) covering Kenyan and Tanzanian everyday speech, Sheng and Bongo slang, and the Swahili clock. It has 192 `terms` and 31 `leftIn` words. Words that are also ordinary words in other languages ("pole", "mambo", "basi", "dada", "kaka", "poa") are left out of `leftIn`.

What was wrong at first (before -> after):
- "mambo mpenzi" -> "G'day mate" -> "Hey babe".
- "basi" meaning the bus was read as "so": "nikachelewa basi | ikaondoka" -> "I was late, so | I took a taxi and left" -> "I was late, so the bus | left, so I caught a taxi".
- "nimekungoja saa nzima" -> "waiting for ages" -> "waiting for a whole hour"; "aibu gani hii" -> "What a shame" -> "How embarrassing".
- "shemeji ametuletea..." -> "Your sister-in-law brought us..." (guessed gender, added "your") -> "My in-law brought us mandazi and chai".
- From English: "tunapaswa kukutana kwa kifungua kinywa ... kama uko tayari" (stiff, bookish) -> "Tupange kukutana kwa chai ya asubuhi wikendi hii kama uko free".
- The Swahili clock is right in valid runs: "saa moja jioni" = 7 pm, "saa tatu asubuhi" = 9 am, "saa nane usiku" = 2 am. It wobbled once ("one in the evening") until the rule went into the first group as well.

Still imperfect:
- Phrase mode: a phrase that ends on a subject whose verb opens the next phrase gives "and then Mia | and then she came". Looking ahead sometimes translates words twice ("my ex with his girlfriend | and his new girlfriend").
- "na Mia je?" still comes out as "And Mia?" rather than "What about Mia?". Into Swahili it sometimes writes "tu-agize" with a hyphen.

Shared code suggestions (not made):
- `GENDER_CUE` (`server/refine.ts`) has no Swahili words, so "bibi ni mgonjwa ... tunampeleka" (Grandma) gets "her" turned into "them". Add mama, bibi, babu, baba, dada, kaka, mke, mume, manzi, demu, msichana, mvulana, shangazi, mjomba.
- `JOINING` (`server/pipeline.ts`) has no Swahili words: add na, ya, wa, za, la, cha, vya, kwa, kama, lakini, ila, halafu, kwamba, ili, au, basi(?) so a phrase doesn't end on a linker.
- Tooling: `scripts/langeval.mjs` ignores failed `exec` calls during the upload. When Fly rate-limited, the run silently used the server's old stub `sw.ts`, and the results looked like a big regression. It should check the uploaded file (for example its length or hash) and stop if it doesn't match.
