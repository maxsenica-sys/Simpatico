# Macedonian (mk): deep pass, 3 runs

Reference `server/slang/mk.ts` written from an empty stub (~21 KB, 8 groups, 150 terms, `leftIn` empty: Cyrillic is caught by the script check). It covers the evidential "-л" forms, doubled clitics ("му го дадов"), and the identical 2nd/3rd person singular aorist. It also warns against Serbian and Bulgarian spellings in output.

What was wrong at first (before -> after):
- "Каде си ма, те чекам..." -> "Where are you, mate?" -> "Where are you, girl?" ("ма" is now marked as address to a woman, never "mate").
- "I'm knackered, can't wait to see you though" -> "Едвај чекам да те видам, јас сум скапан од умор" (reordered, "but" lost) -> "Скапан сум, ама едвај чекам да те видам".
- "You're a legend..." -> "...си легенда што дојде по мене" (clitic at the start of a clause) -> "Легенда си, фала многу...".
- Long stretch: "нели не престанува" -> "nah, she never stops" -> "of course she won't stop".
- "Рече дека нема да дојде, била болна": "apparently" was missing in runs 1–2 and appears in run 3.

Still imperfect:
- "I can't be bothered cooking" came out as "ми се смачи да готвам" in run 3 ("ме мрзи" is the natural form). "keen as" -> "јас сум за!" is fine but plain. A few small tense slips ("што ме земаш").
- Phrase joins: "...со Mia во" | "десет" gave "at at ten", and "кога ќе се" | "жениме" split the reflexive from its verb.

Shared code suggestions (not made):
- `server/pipeline.ts` `JOINING`: add the Macedonian joiners "во", "со", "за", "од", "до", "се", "ќе", "да", "ама", "дека", "кога", "ако", "или". A phrase should not end on a preposition or the clitic "се".
- `server/refine.ts` `leftovers()`: same as bg. Latin transliterations of particles ("bre", "ma") are not caught for Cyrillic languages.
