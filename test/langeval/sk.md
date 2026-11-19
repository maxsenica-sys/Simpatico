# Slovak (sk): deep translation pass

3 runs. Reference written from an empty stub: ~25 KB in 8 groups, plus `leftIn` (27) and `terms` (172). I left out words shared with Czech or Croatian ("ahoj", "zlato", "kurva", "bratu").

What was wrong at first (before → after):
- "Ezgi, si zlatá, ďakujem…" → "you're a **legend**" → "you're a gem".
- "to nie je tvoja starosť" → "**none of your business**" → "that's not your problem".
- "Do riti, zase zápcha" → softened to "Ugh" in run 2 → "Damn it" (a note on keeping swear strength).
- Long: "nemá čas ani na obed no a ona sa | urazila" came back **empty twice** in run 1, so the sentence ended mid-air → in run 3 "she got offended" appears. The phrase before it is still empty, though, so "doesn't even have time for lunch" is lost.
- "ty kokso" → "you bloody beauty" → "bloody hell" / "wow".

Still imperfect:
- From English: "She left me on read again" → "Opäť **na to** nechala na prečítané" (garbled; should be "Zase ma nechala na prečítané"). I added that exact line after run 3, so it is not yet re-run.
- Long stretches phrase by phrase: "Paľo sa tak | ožral" → "Paľo got so | Passed out…" ("drunk" lost, odd capital). Phrases still come back empty at times.
- Minor: "really heaps of work on" (unnatural Australianism).

Suggested shared-code changes (not made):
- `server/pipeline.ts` JOINING: add Slovak "sa, si, a, i, že, ale, na, v, vo, do, z, zo, s, so, k, tak, ako, keď, lebo, či" so phrases don't end on a reflexive or a preposition.
- `server/refine.ts`: retry, or translate alone, when phraseTranslate returns empty for a phrase that has content words. Today the meaning is silently dropped.
- Shared rule: a sentence-initial capital in a non-first phrase ("Passed out") should be lower-cased when the previous phrase didn't end a sentence.
