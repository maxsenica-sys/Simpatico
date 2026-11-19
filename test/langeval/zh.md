# Chinese (zh): deep translation pass

3 runs. `server/slang/zh.ts` grew from about 12 KB to 28 KB. The existing slang, idioms, internet, regional (Taiwan, Cantonese) and swearing groups were kept. New groups: everyday spoken words and fillers; family and affection; culture, food and places; "how it is really spoken"; "Into Chinese". There are now 168 recognition terms. `leftIn` is empty because Han text left in a subtitle is caught by the script check.

What was wrong at first, and the fix:
- "这个周末我们去看电影吧，你有空马" (recognition wrote 马 for 吗): "are you free **mate**?" → "Fancy a movie this weekend? Are you free?"
- From English, "you're a legend for helping out" became thanks ("你真是帮了大忙，太谢谢你了") → "…太牛了" (now marked as praise, with an example).
- "footy" → "橄榄球场" / "足球赛" (soccer) → "球赛" (watching the game).
- Long stretch 2: the phrase "…那家烧烤我已经订好位子了你别忘了" came back empty in runs 1 and 2 ("I've already booked a table" was lost). In run 3 it is kept, after a line saying a clause cut across a phrase is translated once, never skipped.

Good throughout: 她/他 → "they" (recognition picks the character at random), slang (摸鱼, 吃土, 显眼包, 渣男, AA), the Taiwan line (很機車耶…啦), swearing strength, money and times, casual 你 and 吧 in Chinese output.

Still imperfect:
- "他那个人就是个渣男" gives "They're such a player". 渣男 says it is a man, but the gender_check retry (FIX line) forces "they". The same happens for 我妈 in Korean.
- Long stretches are cut every 18 characters, sometimes inside a word ("当着所|有人的面"). Then a clause is said twice ("in front of everyone… told me off in front of everyone"), or the sentence breaks at the cut ("This morning on the train | broke down").
- "esky" can come out as 冰箱 (fridge) instead of 保温箱. That is minor.

Suggested shared changes (not made):
- `server/pipeline.ts`: for unspaced scripts (zh, ja), cut at punctuation or at a sentence-final particle (了 吧 啊 呢 吗 的) near the limit, not at a fixed 18 characters. Or use Soniox token boundaries, which are words.
- `server/refine.ts` GENDER_CUE: add Han kinship and gendered nouns (妈, 老婆, 女朋友, 姐, 妹, 阿姨, 渣女 / 爸, 老公, 男朋友, 哥, 弟, 叔叔, 渣男) with no \p{L} lookbehind.
