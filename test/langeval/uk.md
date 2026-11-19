# Ukrainian (uk): deep pass, 4 runs

The reference went from a 5-line stub to about 28 KB in 8 groups. It now covers false friends with Russian (так = yes, час, година, неділя, вродливий), surzhyk, vocative names, blackouts and alerts ("світло дали", "тривога"), and times ("пів на п'яту" = 4:30, which came out right in every run), plus `leftIn` (transliterations only) and 180 `terms`.

What was wrong at first (run 1 → later runs):
- "Ми з Мією вареники ліпили" → "We made vareniki with Mia" → "Mia and I made vareniki" (after an "ALWAYS ... and I" line).
- "ти як за" (end of the long stretch) → "" (phrase lost) / "you know how it is" → "you in?".
- "ти де взагалі я тебе чекаю" → "Where are you at all?" → "Where are you, anyway?".
- From English, "No worries mate" to a partner → "Нема проблем, друже" → "mate" dropped (run 2; it came back in run 3, so the rule was strengthened).
- Run 3, "Mum reckons we should come over for dinner Sunday arvo": the model mixed up обід (lunch) and по обіді (afternoon) and printed its own self-correction ("…ні, "в неділю по обіді" — тобто: …") into the subtitle. The reference now says arvo = "вдень" and dinner = "вечеря".

Still imperfect:
- "мама з тіткою | Оленою" is cut between phrases and comes out "Mum and Auntie with Olena" (two people), even with a line about it.
- Joins lose words: "коли | весілля" → "so when wedding", "як | дурна" → "like dumb", "бо я | вже…" → "because I and I'm already". In run 3 the final "сил нема" (no energy left) was dropped.
- "Курва" is softened to "Bloody hell" (it should be "Fuck"/"Shit"), and "дача" swings between "dacha", "cottage" and "their place in the country".

Suggestions for shared code:
- `server/pipeline.ts` `JOINING` has no Ukrainian words. Add "і", "й", "та", "з", "із", "зі", "у", "в", "до", "на", "що", "шо", "бо", "коли", "як", "а", "але", "щоб" (and Belarusian "ў", "і", "з", "што", "калі", "як", "бо"), so phrases don't end on a preposition, conjunction or "як". Also add kinship words before a name (тітка/тіткою/дядько).
- `server/refine.ts`: run 3 showed self-correction text ("ні, … — тобто: …") leaking into the subtitle, and in run 1 a phrase came back as `Translation of the new phrase: "…"`. A post-check that rejects outputs with meta wording or more than one candidate (and retries once) would catch both.
- A phrase that comes back empty when the source isn't empty should be retried or fall back, not silently dropped.
