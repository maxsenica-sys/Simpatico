# Romanian (ro): deep pass

Runs: baseline (5-line stub) + 3 runs with the new reference (23 KB, 8 groups, 163 terms); a 4th run hit the Fly API rate limit.

What was wrong at first (before -> after):
- Text without diacritics came back untranslated: "ce faci ma nebunule am auzit ca ti ai luat masina noua" -> "Ce faci, nebunule? Am auzit că ți-ai luat mașină nouă." (Romanian, accents restored) -> run 2 "**How you going, you crazy bastard!**" -> run 3 "Hey you crazy man, I heard you got yourself a new car."
- Into Romanian: "She left me on read" -> "Mi-a lăsat pe citit" (wrong case and word) -> "M-a lăsat iar pe seen"; "you're a legend" -> "ești un adevărat erou" -> "ești cel mai tare"; "this arvo" -> "diseară" (tonight) -> "azi după-amiază"; "ar fi trebuit să vii" -> "trebuia să vii și tu".
- Address terms: "fa" -> "mate"/"babe" -> "girl"; "Fată" -> "Mate" -> "Girl".

Still imperfect:
- Dropped subject still guessed as "he" in about half the runs ("M-a lăsat pe seen" -> "He left me on read" in runs 1 and 3, "They" in run 2). The reference now says so twice; it needs the shared check (below).
- PHRASE lines: cuts inside units double or lose words: "n-am | putut" -> "so I couldn't | could reply" (every run), "supărat pe | mine" -> "upset with | with me" (runs 0-1), and once a whole phrase came back empty ("crezi adică am stat o oră și până" -> "").
- "Cred că ar trebui să..." for "I reckon we should" is still a little stiff.

Shared code suggestions:
- `looksUntranslated` (server/refine.ts) compares raw words, so a source without diacritics handed back with diacritics ("esti" vs "ești") is not caught. Strip combining marks (NFD + remove \p{M}) and hyphens before comparing.
- `subtitleOnly` should strip markdown emphasis (`**...**`, `*...*`) wrapping the whole subtitle.
- `guessedGender` only runs for GENDERLESS languages. Pro-drop languages (ro, it, pt, es) also give no gender for a dropped subject; run the check for them too when the source has no subject pronoun (el/ea, lui/lei, ele/ela) and no gendered word.
- `JOINING` has no Romanian: add "pe", "să", "că", "până", "cu", "din", "și", "n-am", "nu", "mai", "o", "un", "lui", "ca" (cuts like "n-am | putut", "supărat pe | mine", "până | la urmă").
