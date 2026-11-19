# Ukrainian (uk): deep pass, 4 runs

The reference went from a 5-line stub to about 28 KB in 8 groups. It now covers false friends with Russian (так = yes, час, година, неділя, вродливий), surzhyk, vocative names, blackouts and alerts ("світло дали", "тривога"), and times ("пів на п'яту" = 4:30, which came out right in every run), plus `leftIn` (transliterations only) and 180 `terms`.

What was wrong at first (run 1 → later runs):
- "Ми з Мією вареники ліпили" → "We made vareniki with Mia" → "Mia and I made varenyky" (after an "ALWAYS ... and I" line).
- "ти як за" (end of the long stretch) → "" (phrase lost) / "you know how it is" → "are you in?".
- "ти де взагалі я тебе чекаю" → "Where are you at all?" → "Where are you anyway?".
- "Курва, я ключі вдома забула" → "Bloody hell / Bugger, …" → "Shit, …".
- Run 3, "Mum reckons we should come over for dinner Sunday arvo": the model mixed up обід (lunch) and по обіді (afternoon) and printed its own self-correction ("…ні, "в неділю по обіді" — тобто: …") into the subtitle. After arvo = "вдень" and dinner = "вечеря" were added, run 4 was clean but said "ввечері" (evening): a minor slip.

Still imperfect:
- "мама з тіткою | Оленою" is cut between phrases. Runs 1–3 gave "Mum and Auntie with Olena" (two people); run 4 gave "Auntie Olena". It depends on the cut, so it is not reliable.
- Joins lose or garble words: "коли | весілля" → "so when..." wedding", "як | дурна" → "like and I'm like, dumb". The final "сил нема" (no energy left) was dropped in runs 3 and 4.
- "дача" swings between "dacha", "cottage" and "their place in the country". In run 4, "No worries mate" became "Без проблем, зайчику" ("babe" added where the source had none).

Suggestions for shared code:
- `server/pipeline.ts` `JOINING` has no Ukrainian words. Add "і", "й", "та", "з", "із", "зі", "у", "в", "до", "на", "що", "шо", "бо", "коли", "як", "а", "але", "щоб", plus kinship words before a name (тітка/тіткою/дядько), so a phrase never ends on them.
- `server/refine.ts`: add a post-check that rejects meta or self-correcting output (run 3 "ні, … — тобто: …"; run 1 `Translation of the new phrase: "…"`) and retries once.
- A phrase that comes back empty when the source isn't empty should be retried or fall back, not silently dropped.
