# Croatian (hr): deep pass, 2 runs

Reference `server/slang/hr.ts` written from an empty stub (~18 KB, 8 groups, 172 terms, 17 `leftIn` words). It includes Zagreb kajkavian ("kaj", "bum došel") and Dalmatian words ("ćaća", "fjaka", "gušt", "pomalo"). It also has rules to keep output Croatian rather than Serbian: ijekavian forms, "tko", "što", "kruh", "tjedan", and an infinitive after verbs.

What was wrong at first (before -> after):
- "Bok stari, kaj ima, di si?" -> "G'day mate, what's up, where are you?" -> "...what's up, how you going?" (the greeting "di si" now has a worked example).
- "I'm knackered, can't wait to see you though" -> "Jesam krepan, jedva čekam da te vidim, ali baš." (broken) -> "Krepan sam, ali jedva čekam da te vidim."
- "Jebiga, opet sam propustila tramvaj" -> "Ugh, ..." -> "Damn, ...".
- "Malo mi je bed" (unknown slang in run 1, only a guess) is now in the reference. The meaning is right in run 2, but "a bit" got lost.

Still imperfect:
- "That's heaps good, I'm keen as" still doubles up ("baš mi je drago, ja sam baš za!"), and "Hajde da uzmemo" is a Serbian-sounding construction ("ajmo uzeti" is more Croatian).
- "ak bu vreme" -> "if the weather's fine". Kajkavian "vreme" can mean time or weather, so this is ambiguous.
- Phrase joins: a phrase ending on "i" gives "and and" in the WHOLE line (seen in both runs).

Shared code suggestions (not made):
- `server/pipeline.ts` `JOINING`: add the Latin South Slavic joiners "i", "a", "ali", "da", "se", "kad", "ako", "u", "na", "s", "sa", "za", "od", "do", "iz", "jer", "pa", "ili", "što", "će". They are shared by hr, bs, sr and also help sl.
