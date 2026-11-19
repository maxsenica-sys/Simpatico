# Serbian (sr): deep pass, 2 runs (Cyrillic and Latin test lines)

Reference `server/slang/sr.ts` written from an empty stub (~19 KB, 8 groups, 156 terms). Lines are in Latin with Cyrillic for key words. The "how it is really spoken" group covers both scripts, missing diacritics ("sta", "ces"), dropped "je", and "u pola osam" = 7:30.

What was wrong at first (before -> after):
- FROM_EN mixed scripts: 6 replies in Cyrillic and 3 in Latin, plus a word with a Latin "e" inside Cyrillic ("вечeрас") and the wrong word "Крепко сам мртав". -> The "Into Serbian" group is now written in Cyrillic with a firm rule (whole reply in Cyrillic). All 9 replies were consistent Cyrillic in run 2.
- "Јеси ли ти нормалан бре" -> "Are you serious, mate?" -> "Are you out of your mind, mate?".
- "Malo sam smorena" -> "I'm a bit bored" -> "I'm a bit down".

Still imperfect:
- The greeting "Ћао брате, шта има, де си?" is still read as "where are you?" (both runs), even with an explicit example.
- "sta ces bre nzm..." -> "What are you doing, mate?" ("šta ćeš" = oh well). The test line is honestly ambiguous.
- "ostaviti na seen" has no clean Cyrillic form. The reference now suggests "видела је поруку и није одговорила".
- Phrase joins: "...na selo i" | "ona" gave "and and", and "kad ćemo" | "da se venčamo" gave "to to".

Shared code suggestions (not made):
- Script choice: `server/refine.ts` treats "sr" as Cyrillic only. A Serbian speaker transcribed in Latin skips both checks: the script check doesn't fire, and `leftIn` is skipped for Cyrillic languages. Suggestion: for "sr", run the `leftIn` check whenever the source text is Latin. Also decide app-wide which script Serbian subtitles use (the reference now says Cyrillic, to match the "Српски" label).
- `server/pipeline.ts` `JOINING` has no Latin-script South Slavic joiners: "i", "a", "ali", "da", "se", "kad", "ako", "u", "na", "sa", "s", "za", "od", "do", "iz", "jer", "pa", "ili", "će", "što", "šta". Both phrase duplications came from that.
