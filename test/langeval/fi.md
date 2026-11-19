# Finnish (fi): langeval notes

3 runs. `server/slang/fi.ts` went from an empty stub to ~19 KB (8 groups, 23 leftIn, 189 terms), built around spoken Finnish (mä/sä, oon/oot, -ks questions, passive as "we", -kyt numbers).

What was wrong at first (before → after):
- "kolmesataaviiskyt euroo" → "three hundred and twenty-five euros" → now "350 euros" (spoken "-kyt" tens added).
- "Älä viitti, toi pulla on ihan sikahyvää" → "Oh, don't bother, this bun is…" → "you shouldn't have" → now "Oh come on, that bun is really good".
- "Paljon onnea!" (after "Ei oo totta!") → "Happy birthday!" → now "Congratulations!".
- From English: "left me on read" → "jätti lukemattomaksi" (= left it unread, the opposite) → now "jätti vastaamatta"; "say hi to your mum" → "moikkaa äitiä" (= MY mum) → now "sano sun äitille terveisiä"; "puoli kolme" → "half two" → now "2:30".

Still imperfect:
- Gender: "Mummo … se tekee", "Mia … sille", "Max … serkkunsa" all end up "they/their": the built-in gender_check rewrites them (FIX lines, changed: true) even though grandma and the names make it clear.
- Worse, in long speech the gender_check rewrite of a PHRASE dropped a whole clause twice ("se oli ihan poikki bileiden jälkeen" = she was knackered after the party → gone, leaving "and and I told them").
- "I'm keen for a beer" → "Mä oon messissä oluelle" (understandable, a bit odd); "I'm over it" → "mä oon sen yli" (anglicism; a line was added after the last run, not yet re-tested).
- Phrase cut after "sano et mun | pitää" once gave "I have to | to come in".

Suggested SHARED changes (not made):
- `server/refine.ts` gender_check: pass the call's known people and genders (Mia = f, Max = m) and accept family words in the source (mummo, äiti, isä…) as "clear"; in phrase mode, reject a rewrite that is much shorter than the original (it is dropping content, not swapping pronouns).
- `server/pipeline.ts` JOINING: add Finnish joiners (ja, et, että, ku, kun, jos, mut, mutta, mun, sun, siitä, johon, jonka, puoli) so phrases don't end on them.
