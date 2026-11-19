# Slovenian (sl): deep translation pass

3 runs. Reference written from an empty stub: ~26 KB in 8 groups, plus `leftIn` (27) and `terms` (183). I left out words that are ordinary Croatian/Serbian ("hvala", "oprosti", "kao", "ziher", "ljubica").

What was wrong at first (before → after):
- From English, "I miss you heaps" → "zelo mi **manjkaš**" (Croatian-style) → "ful te pogrešam".
- "rada te mam miško" → "Love you, **mouse**" (literal pet name) → "I love you, babe".
- "vedno lahko računaš name" → "count on **us**" ("name" = "na me") → "count on me".
- "Pride jutri po šihtu" → "**She's** coming" (guessed gender), then "Coming after **my** shift" → "They're coming tomorrow after work".
- "sam ful teži" → "really hard going" → "just a real pain though".
- Long: "da kdaj že končno in tko naprej" → "and then she was on about it again" (invented) → "asking when already and so on".

Still imperfect:
- "Za stotaka" is still "a hundred **bucks**" in every run, despite the reference.
- Long stretches phrase by phrase: "letet v | službo ob sedmih" gave "rush to work" and then an **empty** next phrase, so "at seven" was lost (run 3). In run 2 the same cut produced "to work… to work" twice.
- Minor: "Pustila me je na seen spet" (unnatural word order; should be "Spet me je pustila na seen"); "really heaps of work"; "Zlata si" used for "you're a legend" (should be "car si"/"carica si").

Suggested shared-code changes (not made):
- `server/pipeline.ts` JOINING: add Slovenian "in, pa, da, ki, ker, ko, če, v, na, z, s, k, se, si, je, tko, tako, tok" so a phrase doesn't end on a preposition, clitic or "so".
- `server/refine.ts`: retry an empty phraseTranslate result when the phrase has content words (seen in cs, sk and sl).
- Shared rule (en.ts or refine): keep the source currency; for en-AU output don't call euros or crowns "bucks".
