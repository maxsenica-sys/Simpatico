# Bulgarian (bg): deep pass, 3 runs

Reference `server/slang/bg.ts` written from an empty stub (~25 KB, 8 groups, 151 terms, `leftIn` empty: Cyrillic is caught by the script check).

What was wrong at first (before -> after):
- "Абе кво стаа бе, к'во праиш?" -> "Oh, not much, what are you up to?" (greeting read as the reply) -> "...what's going on, what are you up to?" after marking "кво стаа" as always a question.
- Phrase mode, "...ама тя нали не спира и накрая" ended with "we had a fight" taken from next_words, then repeated; run 3 joins cleanly.
- "Свекърва ... леле мале" -> "Oh my God ... oh no" (one exclamation said twice) -> one "oh my God".
- FROM_EN was already good: "Скапан съм, но нямам търпение да те видя", "Пак ме остави на сийн, писна ми вече", correct male forms for Max.

Still imperfect:
- Run 3 left "Абе" in the subtitle as Latin "Abe". The script check misses it because it is Latin text, and `leftIn` is never checked for Cyrillic languages. A line was added after the last run ("never written as Abe"), but it hasn't been tested.
- "кога ще се женим" comes out as either "we'll" or "I'll" get married. "Изкъртен съм" for "knackered" is unusual, and the "though" was dropped. An example with "but" was added after the last run.
- "за имен ден" is read as "my name day" (a guess).

Shared code suggestions (not made):
- `server/refine.ts` `leftovers()`: for Cyrillic-script languages it returns after the script check, so the language's `leftIn` is never used. A Latin transliteration ("Abe", "bre", "ma") gets through. Suggestion: also check Latin transliterations of `leftIn` (or a `leftInLatin` list) when the target is English.
- `server/pipeline.ts` `JOINING`: lacks the Bulgarian joiners "ама", "че", "ако", "за", "от", "до", "ще", "да", "като", "защото", "щото", "или". A phrase ending on "ама" gave "but but" in run 1.
