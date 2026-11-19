# Bosnian (bs): deep pass, 2 runs

Reference `server/slang/bs.ts` written from an empty stub (~19 KB, 8 groups, 165 terms, 20 `leftIn` words). It covers "ba", "bolan/bona", "jarane", "raja", and Turkish and Arabic loans ("merak", "ćejf", "halal/halali", "haman", "akšam", "inšallah"). It also has family words ("babo" = dad, "nena" = grandma, "amidža"/"daidža" = uncles) and food ("burek" is meat only; "sirnica", "zeljanica", "somun", "begova čorba").

What was wrong at first (before -> after):
- "Halali, nisam htjela da te uvrijedim" -> "Halali, I didn't mean to offend you" (left in) -> "Sorry, I didn't mean..." ("halali" added to `leftIn` and marked "never left").
- "Babo pita jel ideš na utakmicu Želje" -> "Dad, are you going..." (read as a vocative) -> "Dad's asking, are you going...".
- "I'm knackered, can't wait to see you though" -> "Jedva sam se srušio, ali..." (wrong) -> "Ja sam totalno crkao, ali jedva čekam da te vidim."

Still imperfect:
- "nena pravi begovu čorbu" -> "Nena's making..." (kept as a name in both runs; Nena is also a real name).
- "Reko mi amidža da ćemo na teferič" -> "He said we're going on a picnic..." in run 2: the uncle was dropped. A line was added after the last run, but it hasn't been tested.
- Small Serbian or Croatian bleed in output ("kuvati" in run 1; "kuhati" was added to the reference), and "neda mi se" is written as one word.
- Phrase joins: a phrase ending on "i" gives "and and" (both runs).

Shared code suggestions (not made):
- `server/pipeline.ts` `JOINING`: the same Latin South Slavic joiners as listed in hr.md ("i", "a", "ali", "da", "se", "kad", "ako", "u", "na", "s", "sa", "za", "od", "do", "jer", "pa", "ili").
- `server/refine.ts` prompt: a family word right before a verb ("babo pita", "nena pravi", "reko mi amidža") is the subject, not a name or a vocative. That would be a general rule worth one line.
