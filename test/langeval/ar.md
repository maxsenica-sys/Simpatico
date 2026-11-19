# Arabic (ar): deep pass

`server/slang/ar.ts` was rebuilt and extended to about 42 KB (UTF-8; Arabic letters are 2 bytes each) in 13 groups. Shared groups (everyday, religious phrases, affection/family, youth, idioms, swearing, culture/food/football) sit beside dialect groups for Levantine, Egyptian, Gulf/Iraqi and Maghrebi. "How it is really spoken" covers: verb gender, I/you ambiguity in `رحت`/`شفت`, tense markers that differ by dialect (Gulf `بـ` = will, Levant/Egypt `بـ` = present, Maghrebi `ن-` = I), negation, recognition spellings. "Into Arabic" says: mirror the other person's dialect, never MSA. Plus 198 `terms`. There were 4 runs, the test set mixes all four dialect areas, and the set ran in full on runs 1, 3 and 4 (run 2 was lost to a Fly rate limit, then rerun).

What was wrong at first (before → after):
- `ما شا الله عليها البنت كبرت` → "Honestly, mashallah, the girl has grown up" → "wow, look how she's grown!" Also `معلش حبيبي` → "Sorry habibi" (run 2) → "Sorry babe". Latin transliterations get past the script check.
- `يخرب بيتك ضحكتني` → "you're such a legend" → "Oh my God, you're killing me".
- `ابن الكلب سرق تلفوني` → "Some bloke nicked my phone" (softened) → "The bastard stole my phone".
- From English, "Can't wait to see you" → `ما عاد أستنى أشوفك` (= I no longer wait) → `ما أقدر أصبر لين أشوفك`. "She left me on read" → `يعطيني سين` (he, present) → `عطتني سين`.
- In a long stretch, `إننا مبنجيش كتير` → "so we won't be late" → "that we don't come often" (after adding Egyptian negation examples).

Still imperfect:
- `شفتها امبارح بالمول` → "She saw her at the mall" in 3 of 4 runs, even with an explicit example (it should be "I saw her"). Haiku reads the object suffix `ها` as the subject. This is the main open issue.
- `لاباس عليك؟` is sometimes read as an answer ("Yeah, I'm good"). From English, gender agreement to a female listener slips now and then (`يا صاحبي` / `إنتَ بطل` to a woman). Output dialect mixes Gulf and Levantine within one line (it follows the context, which is Gulf).
- One run returned `null` for a line (transient).

Shared-code suggestions:
- `leftovers()` (`server/refine.ts`) returns right after the Arabic-script check, so `leftIn` (habibi, yalla, wallah, khalas) is never tested. Run the `leftIn` word check too when the target is English.
- Phrase cutting (`server/pipeline.ts`): run 1 lost and duplicated content where a phrase ended on a verb whose preposition came next (`حكيت | مع ميا` → "I talked … and I chatted with Mia"). Arabic could use a small `joinsForward` list (a final verb before `مع`, `ل`, `على`; and `و`, `يا`, `عشان`, `إنه`, `اللي` at a phrase end).
