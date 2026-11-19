# Malay (ms): evaluation notes

Three runs. `server/slang/ms.ts` went from a 4-line stub to about 21 KB with 10 groups, including "how it is really spoken" and "Into Malay". It also has 151 terms.

What went wrong at first, shown as before → after:
- "Best gila konsert semalam": "Best concert last night" → "Last night's concert was insanely good". The model read "best" as the English superlative.
- "Cam ne ni, kunci kereta hilang": "Hey, how's it going, I've lost my car keys" → "Oh no, I've lost my car keys, what do I do now?"
- "Max kaki bangku" stayed "couch potato" until run 3 added a worked example. It now gives "Max's hopeless at sport".
- "Ok la ok la": "Ok lah, ok lah" → "Alright, alright". `lah` is in `leftIn`, but the source said `la`, which can't go in the list because it is a common word in other languages.
- From English, "Love you, miss you heaps" became "Sayang, rindu sangat", which turned "love you" into the pet name "babe". It is now "Sayang awak, rindu sangat". "Did you just leave me on read?" first came out as two questions saying the same thing and is now one.
- Pet names were being added that the speaker never said: "suka hati kau lah" → "you choose, babe". This is fixed.
- Speech-recognition splits now resolve: "pe nat" → tired, "a ku" → I.

Still imperfect:
- In the long passages, "mak saya ... dia nak masak" still comes out as "my mum ... they want to cook". The `gender_check` FIX pass rewrites it on every run, even though the reference says "mak" means she.
- "adik" (younger sibling, no gender) is sometimes guessed as "little sister" or "little brother".
- From English, a weekend question sometimes asks the same thing twice ("Buat apa ..., dah buat apa-apa tak?").

Suggested changes to the shared code:
- `server/refine.ts`, gender check: before asking for a rewrite, check whether the source names a gendered family word in the same phrase (mak, ibu, ayah, abang, kakak; Indonesian mama, papa). Better still, have `guessedGender` skip "she"/"he" when the source contains one. At the moment the check prompt says "a word like mother counts", but the model still rewrites it.
- `server/pipeline.ts` `joinsForward`/JOINING: add the Malay and Indonesian words that join forward, such as "macam" (like/how, as in "macam mana"), "dengan", "kat", "sebab", "kalau", "lepas", "pastu", "terus", "soalnya". The long test cut "macam | mana", and the last phrase came out as "like where" and once as "mate".
