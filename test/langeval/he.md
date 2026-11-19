# Hebrew (he): deep pass

`server/slang/he.ts` went from a 5-line stub to about 27 KB in 8 groups (everyday, affection/family, youth/online, idioms, swearing, culture, "how it is really spoken", "Into Hebrew"), plus 184 recognition `terms`. There were 3 runs. Hebrew was strong from the first run, and most fixes were for idioms that the model read literally.

What was wrong at first (before → after):
- `חבל על הזמן הסרט הזה, אשכרה בכיתי` → "That movie was a waste of time" → "This film is amazing, I actually cried" (praise is the usual meaning; literal only for someone's wasted time).
- `איזה קטע` → "what a thing" (runs 1–2) → "how crazy" (needed an example in context, not just a gloss).
- From English, "let's catch up" → `בואי נתפוס את עצמנו` (a calque of "catch") → `נשב על קפה בסוף השבוע`.
- `עשתה | לי פרצוף` split across two phrases: "she made the whole evening" (meaning lost) → "she made a face all evening", after adding the idiom.

Still imperfect:
- One PHRASE line left "wallah babe" in Latin letters. The script check only looks for Hebrew script, so Latin transliterations get through (now named in the reference and in `leftIn`, but see below).
- `מאה שקל` → "a hundred bucks" once (added a rule to keep shekels; this hasn't been re-run).
- "mate" said to a woman becomes `אחי` (young Israelis do say this to women, but `אחותי`/`מאמי` reads better). The phrase-join WHOLE lines sometimes show "and then afterwards" or a capital after a comma.

Shared-code suggestions:
- `leftovers()` in `server/refine.ts` returns right after the script check when source and target scripts differ, so `leftIn` is never used for he/ar/fa. Running the `leftIn` word check as well, for Latin transliterations (wallah, sababa, habibi, azizam), would catch the leaks seen in all three languages.
- Phrase cutting (`joinsForward` in `server/pipeline.ts`): a Hebrew phrase ending in a transitive verb (`עשתה`, `דיברתי`) whose object or `לי`/`עם` comes next should hold the verb back, the way Turkish "bi de" is held.
