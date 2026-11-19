# Lithuanian (lt): langeval notes

3 runs. The reference started as an empty stub. It is now about 24 KB: 8 groups, 30 `leftIn`, 187 `terms`.

**Wrong at first (run 1, then fixed):**
- "Perskaitė mano žinutę ir neatrašė" → "She read my message…". This was still wrong in run 2. Run 3 gives "They read my message…" after the reference got an explicit no-subject example.
- "Man jau atsibodo tas darbas, blin." → "…, honestly" (the swear was lost) → now "bloody hell".
- From English: "She left me on read again" → "Vėl paliko mane perskaitytą ir neatsakė" (a calque) → now "Vėl perskaitė ir neatrašė".
- From English: "see you at the footy" came back with a translator's note in parentheses ("sweet as" → …, "footy" could be AFL…). The AFL hint was removed from the reference, and later runs are clean.

**Correct from the start:**
- "pusę aštuonių" → half seven, and "be penkiolikos devynios" → quarter to nine.
- Split prefixes: "pa skambinsiu", "ne žinau", "at važiuos".
- "sako, serga" → apparently they're sick.
- Idioms: "kabinti makaronus ant ausų" → pulling your leg.
- From English uses the right gender for the female listener ("brangioji", "tu tikra šaunuolė / legenda") and for the male speaker ("nusikalęs").

**Still imperfect:**
- PHRASE mode: "…nes pradedam pusę | dviejų…" means 1:30, but the phrase cut puts "pusę" at the end of one phrase. The model writes "half past" and then "two", which gives 2:30. This happened in all 3 runs. Reference wording cannot fix it.
- Look-ahead duplication: "…priėjo ir kažką bjauraus | pasakė" → "said something nasty | said". The verb seen in `ahead` gets translated twice.
- "Aš ne žinau, ar ji at važiuos" → "she": correct, because "ji" is in the source.

**Suggested shared-code changes (not made):**
- `server/pipeline.ts` JOINING: add Lithuanian (and Latvian) forward-leaning words: ir, bet, o, kad, nes, jei, kai, į, su, apie, pas, prie, be, pusę, pusė, tai, kur, kuris, kurį, ar (Latvian: un, bet, ka, jo, uz, ar, pie, par, kur, pus). A cut before the hour word changes the time.
- `server/refine.ts` SELF_TALK: also catch output with a parenthetical note containing "→" or quoted source words ("sweet as" → …).
- lt, lv, el and sq drop the subject, so a 3rd-person verb carries no gender, the same as hu. A lighter version of the GENDERLESS gender_check could cover them when the source has no gendered pronoun, article or adjective.
