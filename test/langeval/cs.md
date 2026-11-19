# Czech (cs): deep translation pass

4 runs. Reference grew from a 5-line stub to ~25 KB in 8 groups, plus `leftIn` (23) and `terms` (163).

What was wrong at first (before → after):
- From English, "I miss you heaps" → "strašně moc **ti chybíš**" ("you miss me", reversed) → "strašně mi chybíš".
- "mam te rada broucku pusu dobrou" (no diacritics) was **copied back untranslated** → "Love you, sweetie, kiss, good night". Fixed with a note that diacritic-less text is still Czech, plus leftIn forms like "broucku" and "dekuju".
- "Kašli na to, to není tvoje starost" → "it's **none of your business**" → "that's not your problem".
- "Prej přijde zítra" → "Apparently **she's** coming" (guessed gender) → "they're coming".
- "Za stovku" → "a hundred bucks" → "a hundred crowns" (in run 4, after adding "100 crowns is about 6 dollars").
- "Mum, love you" → "miluju tě" (romantic) → "mám tě rád".

Still imperfect:
- "ty jsi zlatíčko" swings between "you're a gem / sweetheart" and "you're a legend" from run to run.
- Long stretches, phrase by phrase: "Honza se | tak ožral" gives "Honza got so | and passed out", so "drunk" is lost. In run 4 the last phrase ("sedmou já fakt nevím jak to dává") came back **empty** and its meaning was lost. "mami | dej pokoj" once gave "Mami leave it, mum".
- "ozvi se" sometimes becomes "give us a shout". That is fine for Australian English.

Suggested shared-code changes (not made):
- `server/pipeline.ts` JOINING: add Czech "se, si, a, i, že, ale, na, v, ve, do, z, s, k, tak, když, protože, jestli" so a phrase never ends on a reflexive or a preposition.
- `server/refine.ts` phraseTranslate: an empty result for a non-empty final phrase should trigger a retry, or a fallback to translating that phrase alone. Dropping it silently loses content.
- PHRASE_SYSTEM: when the shown text ends mid-clause ("Honza got so"), the next output must complete it ("drunk he fell asleep…") rather than skip the word.
