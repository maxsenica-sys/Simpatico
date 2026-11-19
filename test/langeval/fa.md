# Persian (fa): deep pass

`server/slang/fa.ts` went from a 5-line stub to about 30 KB in 9 groups (everyday, taarof, affection/family, youth/online, idioms, swearing, culture/food/football, "how it is really spoken", "Into Persian"), plus 190 `terms`. Colloquial Tehrani is the base, with Dari forms noted. There were 3 runs. From English the output was natural colloquial texting Persian from the first run (`دلم لک زده ببینمت`, `جای سوزن انداختن نبود`, `خونه`/`میخوام` forms).

What was wrong at first (before → after):
- `دلم برات یه ذره شده` → "I miss you a little" → "I miss you so much".
- `این گوشی صد و پنجاه میلیون تومنه` → "15 million toman" (run 2) → "150 million toman".
- `اسنپ گرفتم` → "grab a snap ride" → "get an Uber". `شیرینی بگیری` → "something sweet" → "some pastries".
- `ببخشید دیگه` → "Sorry, babe" (an added pet name) → "Sorry, OK".

Still imperfect:
- Gender: `اون پسره` (that guy), `امیر` and `مامانم` all come out as "they" (3 `gender_check` FIX lines per run), even though the reference says the noun or name gives the gender. The shared checker rewrites a correct he/she (see below).
- `ایول` → "Ayy" (2 of 3 runs). `یه | کم خندیدیم` split across phrases → "a we laughed a lot" (it should be "we had a bit of a laugh").
- One PHRASE call came back empty and dropped "my mum has invited us for Friday dinner".

Shared-code suggestions:
- `guessedGender` (`server/refine.ts`): `FAMILY_CUE` has `مامان`/`پسر`/`دختر`, but the `(?![\p{L}])`-style boundary misses colloquial suffixed forms (`مامانم`, `پسره`, `دخترش`, `داداشم`). Allow Persian suffixes (`م`, `ت`, `ش`, `ه`, `مون`, `تون`, `شون`) after a cue. A plainly gendered first name in the source or call names (Amir, Sara) should count as a cue too, as the retry prompt already says.
- Phrase cutting (`server/pipeline.ts`): `joinsForward` should hold back Persian `یه`/`یک`, `و`, `که`, `با`, `از`, `به`, `تو` at a phrase end. Because Persian puts the verb last, a phrase that ends before its verb (`دیر بیدار | شدم`) is common.
- `leftovers()` never checks `leftIn` for non-Latin sources, so transliterations like "azizam" or "dadash" would not be caught (none were seen in these runs).
