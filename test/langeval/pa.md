# Punjabi (pa): eval notes

3 runs. `server/slang/pa.ts` was an empty stub; now ~25 KB, 8 groups, 167 terms, Gurmukhi first with Shahmukhi (Urdu-letter) variants for key words, plus diaspora words (PR, IELTS, study visa, Brampton).

What was wrong at first (run 1 → run 3):
- "lakh" kept and colour added: "ਉਹਦੀ ਤਨਖ਼ਾਹ ਡੇਢ ਲੱਖ ਆ" → "Her salary's a cool one and a half lakh" → "Her salary's 150,000 a month".
- Ergative gender: run 2 gave "Left me on read." (subject dropped) → run 3 "They saw the message and didn't even reply".
- Already right from run 1: "ਮਾਮਾ ਜੀ" → "my uncle", "ਆਪਾਂ ... ਨਿਕਲੀਏ?" → "Shall we head out", "ਚਾਅ ਚੜ੍ਹਿਆ" → "so excited" (not tea), Shahmukhi "کی حال اے ویر" understood, into-Punjabi register ("ਕੀ ਹਾਲ ਆ ਜਾਨ?", "ਹੋ ਜਾਊ", "ਸਭ ਠੀਕ ਹੋਜੂ") natural.

Still imperfect:
- "ਉਹਦੀ ਤਨਖ਼ਾਹ" still "Her salary" in all runs despite an explicit example (Haiku reads feminine "ਦੀ" as the owner).
- "ਰੁੱਸ ਨਾ" → "don't be cranky" (should be "don't sulk"; run 2 got it right).
- Into Punjabi: "thanks" still "ਧੰਨਵਾਦ" (formal) instead of "ਥੈਂਕ ਯੂ".
- Long speech: "ਸਿਆਪਾ | ਪਾਇਆ ਪਿਆ" and "ਟਾਈਮ | ਤੇ ਨੀ ਮਿਲਦੀ" cut mid-expression → the translator invented "the report's due today / I can't even get the report done" before the report was mentioned.

Shared-code suggestions:
- `server/refine.ts`: `SCRIPTS` has no Gurmukhi (or Gujarati) entry, so Gurmukhi text left in an English subtitle is never caught; add `[/\p{Script=Gurmukhi}/u, ["pa"]]` (and accept Arabic script for pa as well, since Shahmukhi speakers are transcribed in it).
- `server/pipeline.ts`: as for Hindi, do not start a phrase with an auxiliary or the second half of a light-verb expression ("ਪਾਇਆ", "ਸੀ", "ਆ", "ਤੇ" as postposition).
