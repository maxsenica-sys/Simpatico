# Norwegian (no): langeval notes

3 runs. `server/slang/no.ts` went from an empty stub to ~18 KB (8 groups, 13 leftIn, 153 terms), with dialect forms (æ/eg, ikkje/itj, ka/kva, koss/åssen) that recognition will produce.

What was wrong at first (before → after):
- "Kjæresten min har lest meldinga" (female speaker) → "My boyfriend has read…" (gender guessed from the speaker) → now "My partner has read my message".
- "si hei til mamma" for "say hi to your mum" (= MY mum) → now "si hei til mora di".
- "koste | oss hele kvelden" (reflexive verb cut across phrases) → "cosying up", and "the whole evening" lost → now "enjoyed ourselves the whole evening".
- "gleder meg til og se deg … vennen" → "I'm looking forward to seeing you, mate" → now "I can't wait to see you tomorrow, babe".

Still imperfect:
- "kis" (girl, youth address) still comes out as "babe" in some runs.
- Verb-second clauses split across phrases ("og det | orker jeg liksom ikke for vi skulle jo i | bursdag"): one run gave "and that can't be bothered … go to birthday", the next translated ahead and then returned an EMPTY phrase, losing "because we were supposed to go to". A dialect-only sentence ("Æ veit itj ka han driv med") is fine.
- "halv elleve" → "half ten" (correct but British; digits would be clearer).

Suggested SHARED changes (not made):
- `server/pipeline.ts` JOINING: add Norwegian joiners (og, å, at, men, som, den, det, en, et, til, i, på, om, for, fordi, halv) and treat a trailing reflexive verb / particle ("koste" + "oss") as joining forward.
- `server/refine.ts` phraseTranslate: never accept an empty reply for a phrase with new content words (retry once or merge it into the next phrase); say in the prompt not to translate words from `ahead`.
- `dropRepeat` misses near-repeats ("I said to | to her", "I said | told her"): compare the last 1–3 words of `shown` with the start of the new phrase case-insensitively.
