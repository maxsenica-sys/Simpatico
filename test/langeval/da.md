# Danish (da): langeval notes

3 runs. `server/slang/da.ts` went from an empty stub to ~19 KB (8 groups, 13 leftIn, 143 terms).

What was wrong at first (before → after):
- Times: "klokken halv | elleve" (cut across phrases) → "half eleven" (reads as 11:30). After the "halv + hour = 30 min before, write digits" rule → "half past ten".
- "Selv tak, det var så lidt" → "Yeah, not bad, no worries" → now "You're welcome, it was nothing".
- "gider du lige ringe til mig" → "can you be bothered giving me a ring" → now "could you give me a ring".
- "den | der fyr" split → "talk about it about the guy" → now "talk about that guy".
- "hyggede os hele aftenen" → "just chatted" → now "had a lovely time all evening".

Still imperfect:
- "halv tre" sometimes comes out as "half two" (correct in AU/UK, but digits would be clearer).
- "kæreste ... hun" now gives "my partner ... she" (safe but slightly odd; "girlfriend" would be fine there).
- Phrase joins: "vi skulle jo | til fødselsdag" gave "supposed to to a birthday" / "going to a birthday party to his birthday party"; one run returned an EMPTY phrase for "med ro men hun ville bare snakke om den", losing "but she just wanted to talk about".

Suggested SHARED changes (not made):
- `server/pipeline.ts` JOINING has no Scandinavian words: add da/no/sv joiners so a phrase doesn't end on them: og, at, men, som, der, den, det, en, et, til, i, på, om, for, fordi, halv, klokken (no: og, å, at, men, som, den, det, en, et, til, i, på, om, for, fordi, halv; sv: och, att, men, som, den, det, en, ett, till, i, på, om, för, eftersom, halv).
- `server/refine.ts` phraseTranslate: an empty reply for a phrase that has new content words should be retried (or the phrase merged into the next one), not accepted; and the prompt should forbid translating words from `ahead` (they cause "to to" / repeated clauses that dropRepeat does not catch because the wording differs).
