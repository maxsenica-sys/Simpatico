# Welsh (cy): 3 runs (plus one run lost to the Fly rate limit)

`cy.ts` went from an empty stub to about 23 KB. It has 8 groups (everyday, affection/family, youth and calls, idioms, swearing, culture/places/rugby, "how it is really spoken" with mutations, "Into Welsh"), 35 `leftIn` and 179 `terms`. The first run was already strong: idioms ("bwrw hen wragedd a ffyn" → raining cats and dogs, "fel lladd nadroedd" → run off my feet), "Tewch!" → "No way!", mutated place names, and "half seven".

What was wrong at first (before → after):
- "Ella awn ni am beint heno" produced self-talk in the subtitle ('"Ella" here is a filler/misreading; ...') → "Maybe we'll go for a pint tonight". The fix was a line saying that North Welsh "ella" means maybe and is not the name Ella.
- "Paid â bod yn twpsyn" → "Don't be a dickhead" (harsher than the original) → "Don't be such an idiot / a dope".
- "fy nghariad" → "my girlfriend" (a guessed gender) → "my love". "ei gariad o" (long run) → "his girlfriend and he and Nan have fallen out" → "his girlfriend and Nan have had another row".
- Into Welsh: "dwi'n llwyth o gyffrous" → "dwi mor gyffrous". "siarada fory" (an order) → "siaradwn ni fory". "yn ffrind i fi" → "yn nhŷ fy ffrind".

Still imperfect:
- "Ffycin hel ... blydi hel" comes out as "Bloody hell ... bloody hell" (once even "strewth") in every run, even with an explicit example. The strong swear is softened.
- "ei gariad o" in the long run is still "his girlfriend" rather than "his partner", because the cariad's gender gets guessed.
- Small extras: "homesick for home"; the misheard "dewi" became "dear" once. Into Welsh still sometimes uses textbook "rydyn ni" and "â'th".

Changes the SHARED code may need:
- refine.ts `SELF_TALK`: it missed '"Ella" here is a filler/misreading; the sentence is ...'. Add patterns like `\bhere is a\b`, `\bthe sentence is\b`, `\bmisreading\b`.
- pipeline.ts `JOINING`: add Welsh leaning words (a, ac, yn, y, yr, i, fy, dy, ei, efo, gyda, achos, bod, mae, ond). A cut after "mae ei gariad" leaves "o" (his) at the start of the next phrase, where it reads as "he".
