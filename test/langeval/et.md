# Estonian (et): langeval notes

2 runs. `server/slang/et.ts` went from an empty stub to ~18 KB (8 groups, 19 leftIn, 179 terms), including the Russian loans common in casual speech (davai, vot, blin, tipa).

What was wrong at first (before → after):
- "Ta on ikka paras jobu" → "They're still the biggest idiot" → now "They're such a total jerk" ("ikka paras" = a real …).
- "me pidime minema mu nõbu sünnipäevale" → "we have to go" → now "we were supposed to go".
- "pool kolm" → "half two" → now "2:30".
- From English: "say hi to your mum" → "tervita ema" (= MY mum) → now "tervita oma ema"; "thanks heaps" → "aitäh jube palju" → now "suur aitäh"; "keen for a beer" → "mul on tuju … õllele" → now "läheks hea meelega ühele õllele".
- Long speech run 1 lost "ta oli peost täitsa läbi" entirely and repeated "told them to take it easy"; run 2 kept everything.

Still imperfect:
- Gender: the reference now says family words and plain names give the gender, and "Vanaema … ta teeb" → "she's making" holds, but the built-in gender_check still rewrites "Mia … ta" and "Max … oma nõbuga" to "they/their" (FIX lines, changed: true).
- Small joins: "talk about it | about a guy" (the phrase ended on "sellest" = about that); "verivorst" is sometimes translated ("blood sausage") rather than kept.

Suggested SHARED changes (not made):
- `server/refine.ts` gender_check: give the checker the call's known names with their gender (Mia = f, Max = m from callNames/people) and the source sentence's family word (vanaema, ema, õde…), or skip the check when the source names the person in the same sentence. Today it overrides correct "she"/"his".
- `server/pipeline.ts` JOINING: add Estonian joiners (ja, et, aga, sest, kui, või, sellest, selle, mu, oma, pool) so phrases don't end on them.
