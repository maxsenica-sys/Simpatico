# Polish (pl): deep translation pass

3 runs. Reference grew from a 5-line stub to ~28 KB in 8 groups, plus `leftIn` (30) and `terms` (161).

What was wrong at first (before → after):
- Long run-on: "że kiedy w końcu i w ogóle" → "asking when **and at all**" → after: "asking when at last, and anyway". This is better but still clumsy, because the phrase is cut right after "kiedy".
- "No worries mate, too easy" → "Spoko, luz, nie ma sprawy" (three synonyms, "mate" lost) → "Spoko, stary, luz."
- "Fair enough, let's catch up" → "No problem, to pogadamy" → "No w sumie racja, to spotkajmy się…"
- "Ja pierdolę, ale korek" softened to "Oh man" in run 2 → "Fuck me, what a traffic jam" after adding a line on keeping swear strength.

Still imperfect:
- "kochana jesteś" (warm thanks) still comes out as "you're a legend", and "za stówę" as "a hundred **bucks**". The reference says not to do either, but the en-AU defaults win. "Legend" is a natural Australian thank-you, but "bucks" changes the currency.
- In phrase mode, "Kuba się tak | nawalił" gives "Kuba got so ended up so wasted" (the repeat isn't dropped). With the final "się | obraziła" it produced both "got all huffy" and "she sulked".
- "ale beka" was once flattened to "Oh man", which loses the "hilarious".

Suggested shared-code changes (not made):
- `server/pipeline.ts` JOINING has no Latin-script Slavic joiners. Add Polish/Czech/Slovak/Slovenian words that lean forward, so a phrase never ends on them: i, a, ale, że, bo, czy, w, z, na, do, o, się, tak, taki, jak; se, si, sa, v, ve, s, ze, k, že, aby, když, ako, tako, tko, pa, in.
- `server/refine.ts` PHRASE_SYSTEM: when the shown text already ends on a dangling "got so" / "she got", the next phrase must finish that clause and not restate it.
- Shared money rule: keep the speaker's currency (zloty, crowns, euros). Don't map local amounts to "bucks" for en-AU.
