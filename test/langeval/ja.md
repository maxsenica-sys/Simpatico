# Japanese (ja): deep translation pass

3 evaluated runs, plus 1 lost when a Fly rate limit corrupted the file upload. `server/slang/ja.ts` went from a 7-line stub to about 27 KB: 8 groups (with Kansai), 176 recognition terms, `leftIn` empty (kana and kanji left in a subtitle are caught by the script check).

What was wrong at first, and the fix:
- "先輩が来週東京に来るって": "**They**'re coming to Tokyo" (先輩 dropped), then "**Your** senpai's coming" → "Apparently my senpai's coming to Tokyo next week."
- "仕事お疲れ〜": "Good work at work!", then "…too brutal~" → "Hope work wasn't too rough."
- "嬉しい！ありがとう、大好き": "Love you **too**" (added) → "Ah, thanks! Love you."
- "3万円もしたのに…": "thirty **grand**" → "30,000 yen". From English, "you're a legend for helping out" became thanks → "手伝ってくれるとか神すぎ！".

Good throughout: dropped subjects (I/you), あの人 → "they", 彼女 → "girlfriend", particles never left in, Kansai (なんでやねん), slang (既読スルー, ドタキャン, 草), and casual plain-form Japanese in the other direction.

Still imperfect:
- "箸の上で待ってて、すぐ行く" (橋 misheard as 箸) returns **null** in all 3 runs, so the refine call fails outright on it. Someone should look at the server log for this input.
- Long stretches are cut every 18 characters inside verbs ("行っ|た", "思っ|たら", "最|悪", "荷物 | 置いたら"). A phrase can come back empty ("着いたらLINEしてね" was lost in run 3), a verb can be invented ("so we were about to give up"), or the dropped object can be guessed wrong ("pick **them** up" for 迎えに行く said to the listener).
- From English: "esky" becomes "エズギのクーラーボックス" (the name hint for Ezgi wins), and "Hey babe" is dropped. Run 1 also wrapped a reply in 「」 and leaked self-talk ("Better, keeping register and not adding: …"); `subtitleOnly` caught neither.

Suggested shared changes (not made):
- `server/pipeline.ts`: for ja, don't cut inside a word. Cut after a particle or connective (て, で, から, けど, たら, ので, し, 、) near the limit, or use Soniox token boundaries. Never cut between a verb stem and た/たら/て.
- `server/refine.ts` `subtitleOnly`: strip 「」『』 around the whole subtitle, and drop a line that starts with "Better," or "keeping register".
- GENDER_CUE: add お母さん, 母, 彼女, 姉, 妹, 嫁 / お父さん, 父, 彼氏, 兄, 弟, 旦那.
