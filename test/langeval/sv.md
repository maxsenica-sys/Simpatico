# Swedish (sv): langeval notes

3 runs. `server/slang/sv.ts` went from a 5-line stub to ~18 KB (8 groups, 17 leftIn, 160 terms). The old leftIn "liksom" was dropped: it is also an ordinary Norwegian word.

What was wrong at first (before → after):
- "vi satt bara och myste" (with grandma) → "we just sat there cuddling" → now "we just sat and had a cosy time".
- "det orkar jag | liksom inte för vi skulle ju på kalas" → "I can't face it not for we were supposed to be at a party" → now "I just can't face that because we were supposed to go to a party at my cousin's".
- From English: "I'm over it" → "jag är över det" (an anglicism) → now "jag orkar inte mer"; "say hi to your mum" → "hälsa mamma" (sounds like MY mum) → now "hälsa din mamma".
- "halv tre" → "half two" → now "2:30" in most runs.

Still imperfect:
- "Sjukt god kanelbulle asså" still comes out "…, mate" even with an explicit "never mate" line: Haiku seems to map a sentence-final filler to Aussie "mate". Probably needs the leftIn/echo check to flag an ADDED "mate" when the source has no address term.
- Phrase joins in long speech: one run reordered and stuttered ("I said told her to take it easy, but the guy she'd met and she just wanted to talk about"); another returned an EMPTY phrase and lost a clause.
- "er" (you plural) is sometimes rendered "you both".

Suggested SHARED changes (not made):
- `server/pipeline.ts` JOINING: add Swedish joiners (och, att, men, som, den, det, en, ett, till, i, på, om, för, eftersom, halv) so phrases don't end on them.
- `server/refine.ts` phraseTranslate: no empty replies for phrases with new content (retry or merge); tell it not to translate `ahead` words, and to keep source order across phrases (it moved "the guy she'd met" before "she just wanted to talk about").
- Shared rule: don't add an address term ("mate", "babe") the source doesn't have.
