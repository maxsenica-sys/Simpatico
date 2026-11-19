# French (fr): France and Québec, 4 runs (run 3 hit the Fly rate limit and was redone)

The reference grew from 10.6 KB to about 35 KB. New groups: affection and family, a fuller Québec group, culture and food, "how it is really spoken", "Into French (from English)". Added a longer `leftIn` and 186 `terms`.

What was wrong at first (before → after):
- "Je lui ai dit que c'était mort" → "I told him it was dead" → "I told him it was off".
- "c'est pas vrai sa mère elle a dit ça ? ses trop drôle" → "did his mum really say that? She's so funny" (a guessed gender, and "ses" read as "she's") → "No way, their mum said that? That's so funny."
- "sa copine elle s'est pris la tête" (long run) → "his girlfriend she got into it" → "his girlfriend got into it". The fix was a rule that spoken French repeats the subject.
- From English: "Ugh, I'm cooked" → "Ugh, je suis crevé" → "Pff, je suis crevé". "My shout" in Spanish/French now comes out as "c'est moi qui invite". "You're a legend" gave "t'es un chef d'or" twice. It now gives "t'es un amour" or "t'es un chef".

Still imperfect:
- Québec sacres get softened. "Câlisse que je suis tanné" comes out as "Ugh, I'm so over this car" in every run, even with an explicit example in the reference. The model seems to resist putting "fuck" in this spot.
- "esque tu peux me rappeler" (a misheard "est-ce que") comes out as "Ezgi, can you call me back?" in 2 of 4 runs. The name hint for Ezgi overrides the reference line that says "esque" is a question marker.
- "Tsé" at the start gets dropped or becomes "Ah"/"Yeah" instead of "You know". This is minor.

Changes the SHARED code may need (described, not made):
- pipeline.ts `JOINING`: French has no leaning words beyond articles and prepositions. Cuts after "c'est", "il voulait", "je", "on", "sa", "son", "mon", "une", "pas", "trop" produce "my brother wanted no longer wanted" and "it's it's a nightmare" in the WHOLE line. Add c'est, je, tu, il, elle, on, ne, sa, son, ses, mon, ma, ta, une, au, aux, très, trop. Separately, a verb whose "plus"/"pas" may follow should not end a phrase.
- name hints (refine.ts): don't offer a call name as the reading of a frequent function word in the source language (French "esque/eske" → Ezgi).
- Don't run several langeval jobs in parallel. The Fly API rate-limits, and dropped upload chunks can silently test a corrupted or deployed slang file.
