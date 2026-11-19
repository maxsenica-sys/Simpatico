# Russian (ru): deep pass, 3 runs

The reference went from 12 KB (slang lists only) to about 30 KB, adding groups for affection and family, "how it is really spoken", "Into Russian (from English)", plus `leftIn` (Latin transliterations only) and 170 `terms`.

What was wrong at first (run 1 → run 3):
- "Пиздец, я ключи дома забыла" → "Oh no, I left my keys…" → "Shit, I left my keys…" (мат was softened to nothing).
- "полтора косаря" → "fifteen hundred bucks" → "fifteen hundred roubles".
- "мама с тётей | Леной" (cut between phrases) → "Mum with my aunt … sitting there with Lena" (two people) → "Mum with Auntie Lena".
- "…в баню сходим а то я уже как белка в колесе… ты как за" → "otherwise … how about you" → "'cause I'm already run off my feet… you in?".
- From English, "thanks for picking me up" to a woman came out as "забрал" (masculine) once. Run 3 gave "заехала". The rule now is to match the listener's gender in every verb.

Still imperfect:
- "Мы с Мией пельмени лепили" still comes out as "We made pelmeni with Mia" (should be "Mia and I"), in all 3 runs, even with an explicit ALWAYS rule and an example. Haiku seems to prefer the literal reading.
- "созвонимся" is sometimes "let's call", sometimes "let's catch up" (it varies between runs).
- In from-English lines, "I reckon" sometimes lands at the end ("…сегодня вечером, думаю") and reads a bit tacked-on.

Suggestions for shared code:
- `server/pipeline.ts` `JOINING`: the Russian entries are only и/а/но/что/когда/в/на/с. Add "как", "у", "к", "по", "за", "из", "от", "до", "о", "про", "же", and words like "тётя/тётей/дядя" (a kinship word followed by a name) so a phrase never ends on them. "стою как | дура" and "мама с тётей | Леной" both suffered from cuts like this.
- `dropRepeat` (server/text.ts) misses near-duplicates where phrases join: "then | Then Mia showed up", "well | like, when's the wedding". It could compare case-insensitively and drop a repeated filler or connective at the start of the new phrase.
- `server/refine.ts` prompt: a general rule that "we with X" constructions in Slavic languages (мы с / ми з / мы з) mean "X and I" would serve ru, uk, be and pl at once, and might carry more weight than the per-language line.
