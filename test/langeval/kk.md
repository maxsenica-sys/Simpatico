# Kazakh (kk): langeval notes

3 runs. `server/slang/kk.ts` was an empty stub; it now has 8 groups (about 29 KB, Cyrillic), 186 `terms`, and an empty `leftIn` (any Cyrillic left in an English subtitle is caught by the script check).

What was wrong at first (before -> after):
- The particle "ғой/қой" came out as a made-up address term: "қайдасың? ... күтіп тұрмын ғой" -> "...for an hour now, babe."; "қымбат қой" -> "that's pricey, mate". Fixed: "қымбат қой" -> "that's pricey."
- The evidential "-ыпты" came out as "apparently" (and in bold): "жеңгем ... баурсақ әкеліпті" -> "**My sister-in-law brought us qurdaq and baursaks, apparently.**" -> "My sister-in-law brought us kuyrdak and baursak."
- From English: "how good was the footy" came out as a question ("Матч қандай болды кеше?") -> "Кешегі матч керемет болды ғой!"; "it's doing my head in" -> "басым қатып тұр" (I'm confused) -> "миымды жеп бітті"; "this weekend" -> "бұл аптада" (this week) -> "сенбі-жексенбіде ... қаласаң".
- "апам ауырып қалды, ... апарамыз" -> "taking them" -> "we're taking Mum to hospital" (the reference now asks for the noun again, which gets past the gender check).

Works reliably now: Russian mixing ("короче", "там вообще ничего не было", "звонить етем") and Kazakh letters written as Russian ones ("калайсын", "жаксы").

Still imperfect:
- Phrase mode: an auxiliary at the start of a phrase is still sometimes read as a new action ("ұялып | қалдым" -> "...embarrassed | I was left there"), and a phrase that ends on a noun object repeats its verb ("шай | іштік" -> "had tea | we had tea").
- "ол" plus a clear cue in the source ("бұрынғы жігітім жаңа қызымен" = my ex-boyfriend with his new girlfriend) still comes out as "their new partner".

Shared code suggestions (not made):
- `GENDER_CUE` in `server/refine.ts` only knows Turkish and English words, so the gender check turns "she" for "мама/апам/әжем" or "his" for "жігітім" into "they". Add Kazakh cues (мама, апа, анам, әже, әпке, сіңлі, қарындас, ағa, көке, әке, папа, жігіт, қыз, күйеу, әйел, жеңге, жезде, келін) and allow cues in the English output ("Mum", "Grandma").
- `joinsForward` in `server/pipeline.ts`: for verb-final kk/az, don't start a new phrase with an auxiliary (қалдым, қалды, кетті, кеттім, жатыр, отыр, тұр, жүр, алдым, бердім, қойдым). Move the cut back one word, or carry the auxiliary into the previous phrase.
