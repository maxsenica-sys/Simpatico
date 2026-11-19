# Hindi (hi): eval notes

4 runs. `server/slang/hi.ts` was a shared Hindi/Urdu list (12 KB); now a Hindi-only (Devanagari + Hinglish) reference, ~34 KB, 8 groups, 160 terms. Urdu moved to its own `ur.ts`.

What was wrong at first (run 1 → run 4):
- Guessed gender from the ergative/possessive: "उसने ... रिप्लाई नहीं किया" → "He left me on read" → "Left me on read ... the attitude on them"; "उसकी सैलरी डेढ़ लाख" → "He earns ... " / "Her salary's one and a half lakh" → "Their salary is 150,000 a month" (rules: with "ने" the verb follows the object; "उसका/उसकी" follow the thing owned; never write "lakh").
- Address term left in: "मामा जी" → "Mama ji" → "Uncle's coming".
- Insult softened: "वो चूतिया फिर से लेट आया" → "That clown" → "That fucking idiot was late again".
- Meta text leaked: "मेरे को ना वो प्लान ..." → `"I didn't like that plan at all, mate" — rendered naturally for an Australian listener.` → "Honestly I didn't like that plan at all" (mid-sentence "ना" now documented as a filler).
- Into Hindi: "आप वीकेंड पर कुछ खास किया?" (wrong register, broken grammar) → "तुमने वीकेंड पे कुछ ख़ास किया?"; doubled "can't wait" phrase fixed.

Still imperfect:
- "नाराज़ मत हो" keeps coming out as "don't be cranky" (acceptable Australian, but "upset" was asked for).
- "में ठीक हूँ तुम बताओ कैसे हो" (recognition wrote "में" for "मैं") returned null in 2 of 4 runs: the translator gave nothing usable, so the subtitle is lost.
- Long speech: phrases cut mid-verb repeat or lose words: "मैं मम्मी के साथ | मार्केट गई थी" → "I was with Mum went to the market"; "मिया | मिल गई" → "ran into Mia | bumped into her"; "सुबह | से मीटिंग" → "every morning | from morning meetings".

Shared-code suggestions:
- `server/pipeline.ts`: Hindi/Urdu (and other Indic) postpositions and auxiliaries attach BACKWARD: a phrase should not start with "से", "को", "में", "पे", "का/की/के", "है/हैं/था/थी/थे", "हूँ", nor end on "और", "कि", "उसने", "किसी को". Today `joinsForward` has no Indic words at all.
- `server/refine.ts`: `subtitleOnly` could strip a trailing explanation after an em dash or a leading label like `Native Australian English:` and surrounding quotes (seen in hi and ur).
- Investigate the null on "में ठीक हूँ ..." (probably `looksUntranslated` or an empty reply).
