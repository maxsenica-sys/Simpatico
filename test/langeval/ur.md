# Urdu (ur): eval notes

4 runs. `server/slang/ur.ts` was empty (Urdu borrowed the Hindi list via `SETS.ur = SETS.hi`); now its own Urdu-script reference, ~25 KB, 8 groups, 168 terms (Pakistani food, family words, Karachi/Lahore slang, Roman Urdu note). The fallback in `index.ts` no longer applies because `ur.groups` is non-empty.

What was wrong at first (run 1 → run 4):
- Guessed gender: "اس نے میرا میسج سین کر کے جواب ہی نہیں دیا" → "He left my message on read" → "They left my message on read and didn't even reply"; "اس کی تنخواہ ڈیڑھ لاکھ ہے" → "Her salary's 150k" → "Their salary's 150,000".
- Infinitive-as-request misread: "کھانا کھا کے جانا" → "we should eat before we go" → "you should eat before you go".
- Insult dropped: "وہ بے غیرت پھر سے لیٹ آیا" → "He was late again" → "That shameless bastard showed up late again".
- Into Urdu: "love you" came out in Devanagari ("لव یو") → "لو یو".

Still imperfect:
- Variance leaks in run 4: one reply prepended the previous context sentence ("Mate, today's been so tiring ... Mia's mehndi was such a laugh"), another was prefixed `Native Australian English: "..."`. Not fixable from the reference.
- "ناراض تو نہ ہو" still "don't be cranky"; "اچھا بابا" once became "Oi" (softener line added after the last run, not yet re-tested).
- Long speech: "اس | کا رشتہ" and "اور اس نے | کسی کو بتایا" cut across phrases → "she engagement is sorted", "and she and hadn't told anyone", and in run 4 the final phrase came back empty so "hadn't told anyone" was lost.

Shared-code suggestions:
- `server/pipeline.ts`: never end a phrase on "اس", "اس نے", "اور", "کہ", or start one with "کا/کی/کے", "سے", "ہے/ہیں/تھا/تھی"; the next 3 `ahead` words are not enough for Haiku to hold back.
- `server/refine.ts`: strip `Label:` prefixes and quotes in `subtitleOnly`; consider a guard that the reply does not contain text from `recent_conversation` the utterance does not have.
