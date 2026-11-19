# Azerbaijani (az): langeval notes

4 runs. `server/slang/az.ts` was an empty stub; it now has 8 groups (about 21 KB) and 174 `terms`. The 33 `leftIn` words are mostly ones with ə/ı/ğ/q/x, so they can't be ordinary words in other languages. The reference covers Baku speech, Russian mixing, false friends with Turkish, and "beşin yarısı" = 4:30.

What was wrong at first (before -> after):
- "başım çox qarışıqdı bu həftə" -> "my head's been all over the place this week". It slipped back once; after a second rule in "how it is really spoken" -> "I've been really busy this week, sorry".
- "bəs Mia?" -> "So Mia?" -> "What about Mia?"; the "axı" at the end of a sentence -> ", after all" -> "you know" (tone).
- "gözün aydın, eşitdim qızın olub" -> "I heard your daughter's had a baby" -> "I heard you've had a baby girl!".
- From English: "tonight" -> "bu gecə" -> "bu axşam"; "doing my head in" -> "başımı yeyir" -> "beynimi yeyir"; "you're a legend" -> "Sən əla adamsan" -> "Əlasan!", "Sən bir dənəsən".

Still imperfect:
- "anam deyir ... dolma bişirəcək" still often comes out as "they're going to make dolma". The translator writes "she", and the shared gender check changes it to "they" (see below).
- Phrase mode is clean apart from the odd missing comma where phrases join. "Ezgi xanım" sometimes drops the name altogether.
- From English it sometimes slips into Turkish forms ("Dün gecə" for "Dünən axşam").

Shared code suggestions (not made):
- `GENDER_CUE` in `server/refine.ts` lists only Turkish and English words. Azerbaijani "anam", "nənəm", "bacım", "qızım", "oğlum", "ərim", "arvadım", "xala", "dayı", "əmi", "bibi", "xanım", "müəllim", "qardaş", "sevgilim" aren't cues, so a correct "she" for Mum is undone. Add the Azerbaijani forms. The Turkish list already catches "dayı" and "hanım", but not "ana-" or "nənə".
- `JOINING` in `server/pipeline.ts` has Turkish "ve/ama/ile/için/gibi" but not Azerbaijani "və", "amma", "ilə", "üçün", "kimi", "ki", "çünki". `TR_LEANS` could get Azerbaijani "bir", "çox", "nə", "niyə", "necə", "hansı", "daha", "heç", "hər", "bu", "o", "belə", "elə".
