# Latvian (lv): langeval notes

4 runs. The reference started as an empty stub. It is now about 25 KB: 8 groups, 32 `leftIn`, 173 `terms`.

**Wrong at first (then fixed):**
- "Labdien, kā jums iet, tantīt?" → "how are you going, love?" → now "…, auntie?". Address terms now say to keep auntie and uncle.
- "Desmit eiro par aliņu, nu ko tu saki!" → "come on, what are you saying!" (run 2, literal) → now "no way!".
- "Viņš atkal pūš pīlītes" → "He's blowing ducklings again" (run 3) → now "He's telling porkies again". The idiom was added to the "how it is really spoken" group as well.
- From English, run 1:
  - "Mum's coming for dinner" → "Mammīte nāk … pusdienot" (lunch) → now "Mamma nāk uz vakariņām".
  - "tonight" → "tonakt" → now "šovakar".
  - "stuffed train" → "pilnīgi sabojāts" → now "atkal salūzis".
  - "Honestly" → "Patiesi" → now "Godīgi".

**Correct from the start:**
- Times: "pusastoņos" → half past seven, and "pusdivos" → half past one, even across a phrase cut.
- Reported "-ot" ("esot slima" → apparently sick).
- Split prefixes: "pie zvanīšu", "at nāks", "ne zinu".
- Slang: krindžs, paģiras, bļin.
- From English: gender is right ("mīļā" to the woman, "esmu pilnīgi beigts" for the male speaker), "tu" everywhere, and "Nav problēmu, vecīt, tu esi leģenda!".

**Still imperfect:**
- "Makss ir tik forš čalis, vai ne?" sometimes becomes "He's such a good bloke", dropping the name.
- "Mana draudzene" is translated as girlfriend in some runs and friend in others. That is acceptable, because the word is ambiguous.
- In run 3, one TO_EN line came back as just ">". That is a translator glitch, not a reference problem.
- PHRASE mode, run 3: one phrase leaked the model's own reasoning into the subtitle: "Grandma's…" — but the subtitle already says "to visit", so continue naturally: … The SELF_TALK filter in `server/refine.ts` does not catch "the subtitle already says" or "continue naturally". Those phrases should be added.
- Phrase joins are otherwise clean for Latvian.

**Suggested shared-code changes (not made):**
- `server/refine.ts` SELF_TALK: add "the subtitle (already )?says", "continue naturally", and a leading quoted sentence followed by " — but".
- `server/pipeline.ts` JOINING: add un, bet, ka, jo, uz, ar, pie, par, kur, lai, pus.
