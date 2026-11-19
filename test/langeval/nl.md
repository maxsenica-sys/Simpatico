# Dutch (nl): langeval notes

Runs: 3. Reference grew from 6 lines to about 26 KB (8 groups, 166 terms). It covers both Netherlands and Flemish usage (gij/ge, goesting, plezant, amai, allez, ik zie u graag) and street slang (wollah, mattie, sahbi). It also covers modal particles, half acht, false friends and split compounds.

What was wrong at first (before → after):
- "Kut, de trein heeft weer vertraging" → "Damn, …" (too soft) → "Shit, the train's delayed again". A rule now says to keep a real swear.
- "wat een trut" → "what a bitch" → "what a cow" in run 2. Run 3 went back to "bitch", so this is still variable.
- Long phrase "en ik zo nee oma" → "no Oma" → "no Grandma" ("oma" and "opa" were added to leftIn and to the rules).
- FROM_EN "Did you leave me on read?" → "Heb je me op gelezen laten?" (ungrammatical) → "Heb je me op gelezen gelaten?". "Sorry I missed your call" → "Sorry dat ik je gemist heb" (lost "call") → "Sorry dat ik je oproep heb gemist". "did you get up to much?" → "heb je nog wat leuks gedaan?".
- "schat, luister even" at the start of a long stretch → "Look, …" (lost "babe") → "Babe, listen, …".

Still imperfect:
- "op het terras" still comes out as "on the terrace", despite a rule. It should be "outside at a café or pub".
- "trut" strength is still variable.
- Flemish "amai" is sometimes dropped.
- "Ik zie u graag" once came out as "I love you too", with an added "too".

Shared code suggestions (not made):
- `server/pipeline.ts` JOINING only covers nl "en" and "de" by chance (they are there for Spanish). Add omdat, dat, maar, want, als, of, het, een, die, wat, met, voor, naar, bij, van, op, and do not end a phrase on a finite auxiliary (had, heeft, ben, is). For example, "die had | weer zoveel gekookt" gives "she had again cooked".
- In WHOLE lines, a phrase that starts mid-sentence is sometimes capitalised ("I'll make it up Promised, …"). This is the same issue as in German.
