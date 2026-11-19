# Hungarian (hu): langeval notes

3 runs. The reference started as a 4-line stub. It is now about 27 KB: 8 groups, 35 `leftIn`, 170 `terms`.

**Wrong at first (run 1, then fixed):**
- "Puszi." → "Hugs." → now "Xx". The reference now says puszi means kisses, not hugs.
- "a mama szülinapja" → "her mum's birthday" → now "Grandma's birthday". "(a) mama" with the article means grandma.
- "Hogy tetszik lenni, Kati néni?" → "How are you going, Kati auntie?" → now "How are you doing, Auntie Kati?". Néni and bácsi now go before the name in English.
- "Ötezer forint volt egy korsó sör, nem semmi." → "not bad at all" (the meaning is reversed) → now "that's steep".
- From English: "the train's stuffed again" → "megint tele van a vonat" (the train is full) → now "megint elromlott a vonat". "Stuffed" for a broken thing is now covered.

**Correct from the start:** times ("fél hétre" → half six, "háromnegyed nyolc" → quarter to eight), split prefixed verbs ("meg csinálom", "fel hív"), polite "tetszik" forms, "seenen hagyott", and slang (király, gáz, kiakadt). The from-English output used "te" with "szívem" and "király vagy", which reads naturally.

**Still imperfect:**
- Gender guessing: with no subject, the model sometimes still writes "she" for an unnamed person (run 2: "Látta… seenen hagyott" → "She read my message"). The gender_check usually rewrites it to "they", but the rewrite can produce "Max is such a good bloke, aren't they?". The "ugye = right?" line now avoids that tag question.
- Mild swears are softened: "baszki" → "geez" / "honestly".
- PHRASE mode:
  - "…romkocsmába amiről | meséltem" ends the first phrase on the relative word, and the model then says "told you about" twice.
  - "szóval elég | gáz volt" became "so, pretty | it was awful" in run 1.
  - In run 3, one phrase came back empty ("rétest … fél egykor"), so the WHOLE line lost it.

**Suggested shared-code changes (not made):**
- `server/pipeline.ts` JOINING: add Hungarian words that lean forward: hogy, és, meg, mert, de, ha, amikor, ami, amit, amiről, aki, ahol, elég, nagyon, egy, a, az, nem. A phrase should not end on these.
- `server/refine.ts`: after gender_check swaps he/she to "they", fix the verb or tag that follows ("aren't they" after a singular name), or rewrite to the name.
