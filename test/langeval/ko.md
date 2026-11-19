# Korean (ko): deep translation pass

3 runs. `server/slang/ko.ts` went from a 6-line stub to about 23 KB: 8 groups, 162 recognition terms, `leftIn` empty (Hangul left in a subtitle is already caught by the script check).

What was wrong at first, and the fix:
- "언니 이번 주말에 축구 보러 갈래?": "watch the **footy** this weekend" (run 1), then "…, **Mia**?" (run 2: invented a name from the call). Now: "Hey, want to go watch the soccer this weekend?" (lines say 축구 = soccer, never footy; a bare 언니/형 is dropped, never swapped for a call name).
- "내일 갈 게 기다려" (split -ㄹ게): "I'll be waiting for you tomorrow" → "I'll be there tomorrow, wait for me".
- From English: "Too easy" → "쉬워" (literal) → "문제없어"; "Sorry I'm running late" lost the lateness ("미안, 길이 완전 막혔어") → "…좀 늦을 것 같아"; "footy" → "풋볼" (American football) → "경기".
- Long stretch: "…진짜 너무 | 속상했어" ended "it was really so upset" → "I was really upset".

Good throughout: dropped subjects (I/you from statement/question), 걔 → "they", 오빠 → "babe", 반말 kept casual in both directions, swearing strength (씨발 개빡치네 → "Fuck, I'm so pissed off"), money and times.

Still imperfect:
- "우리 엄마가 너 한번 보고 싶대" → "Mum says **they**'d love to meet you" every run. The gender_check (FIX line) forces "they" because `GENDER_CUE` only knows Turkish and English words.
- "esky" in English sentences turns into the name Ezgi (에즈기 아이스박스) in all three languages: the name-hint soundalike wins over the ordinary word.
- Long stretches: "겉옷 꼭 | 챙겨" gives "...be sure to bring a jacket" and then "bring" again. The phrase before already took the verb from <next_words>, and dropRepeat misses a single repeated word. "카톡 해 | 줘 짐 놓고 나서…" lost "after you drop your bags".

Suggested shared changes (not made):
- `server/refine.ts` GENDER_CUE: add CJK kinship and gendered nouns (엄마/언니/누나/여친/아내, 아빠/오빠/형/남친/남편; zh 妈/老婆/女朋友/渣男…; ja お母さん/彼女/彼氏…). Hangul and Han need no \p{L} boundary.
- `server/pipeline.ts` joinsForward for ko: keep phrase-final adverbs and auxiliaries with the next phrase (너무, 진짜, 좀, 막, 꼭, 안, 못, 잘, 다), and never cut between a verb and 줘/줄게/봐/있어.
- After a phrase uses the <next_words> verb, the next phrase should drop a leading copy of it (dropRepeat at the word level, for the first 1–2 words).
- Name hints: don't offer a call name for a common English word ("esky") when the sentence makes sense with it.
