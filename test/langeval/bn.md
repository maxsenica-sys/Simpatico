# Bengali (bn): deep pass, 4 runs

The reference grew from 11 KB (slang only) to about 35 KB. New: family and couples, food and culture, Dhaka and Kolkata speech forms, "how it is really spoken" (no he/she, verb ending gives the person, polite "-চ্ছেন" = a respected third person, negation AFTER the verb, কাল = yesterday or tomorrow, clock times, the -ও/-ই endings, Banglish), "Into Bengali" (register, Bangladesh vs West Bengal words), and 149 recognition terms. `leftIn` is empty because Bengali script is already caught by the script check.

What was wrong at first, before → after:
- "বাবা এখন ঘুমোচ্ছেন, পরে ফোন করো" → "Dad's asleep right now, ring them later" → "Dad's sleeping right now, call back later".
- Into Bengali, stiff words: "দুঃখিত" (sorry), "সপ্তাহান্তে" (weekend) → "সরি", "উইকেন্ডে কিছু করলি?". Weekend took two runs and a line placed first in the group.
- Long run-on, "তুই যদি | ডিসেম্বরে যাস তাহলে একসাথে গেলে ভালো হয়, না হলে": run 3 made up "mate, do you want to come, and if not". Final run: "if you go in December, it'd be good to go together, otherwise I won't go alone".
- Verb ends that spill into the next phrase ("দাঁড়িয়ে থাকতে | হলো"): "had to" was written twice. Better now, but it still varies from run to run.

Still not right:
- PHRASE/WHOLE on the first long sentence is still the weak spot. A phrase that starts with the end of a verb ("হলো, তারপর … রেগে") sometimes comes back as [nothing], so "when I got to the office" is lost. The subject "boss" then turns into "they". The last phrase repeats "didn't get time to look up".
- "মাশাআল্লাহ" is sometimes left as "Mashallah", and "ইনশাআল্লাহ" is dropped instead of becoming "hopefully". "নাকি" (apparently) is never translated.

Changes the shared code needs:
- `server/pipeline.ts`: the phrase cutter has no joining words for Indic languages. Do not end a phrase on "যদি", "যে", "কারণ", "আর", "কিন্তু". When the next word is a bare verb end or negation ("হলো", "ছিল", "না", "নি", "নাই"), pull it into the current phrase.
- `server/refine.ts` `leftovers()`: for a non-Latin source it only checks the script. Add a small list of romanised words that should not appear in English output (Mashallah, Inshallah, Alhamdulillah, yaar, machan) and check the output for them even when the source does not contain the same spelling.
- PHRASE_SYSTEM: the rule "a last phrase of one or two words is usually just the verb" also fires on mid-sentence phrases that start with an auxiliary. Add: "if the phrase has a new subject, object or place, it is never [nothing]".
