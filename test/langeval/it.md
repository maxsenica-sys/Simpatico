# Italian (it): deep pass

Runs: baseline (8-line stub) + 3 runs with the new reference (23 KB, 8 groups, 154 terms).

What was wrong at first (before -> after):
- Guessed gender for a dropped subject: "Mi ha lasciato in visualizzato tutto il giorno" -> "She left me on read" -> "Left me on read"; "quello che dice" -> "what he says" -> "what they say".
- Fillers taken literally: "e niente" (story filler) -> "pretty much nothing" -> "and, well,"; "sei troppo forte" -> "you're too much" -> "you're hilarious"; "ho preso trenta" -> "I got a thirty" -> "I got top marks"; "raga" -> "Mate" -> "Guys".
- Into Italian: "No worries mate" -> "Figurati, grazie mille" (thanks invented) -> "Figurati, sei un mito"; "sul visto" -> "in visualizzato"; "avresti dovuto venire" -> "dovevi venire anche tu"; "spero che ti senti" -> "spero che tu stia meglio".
- Phrase-join repeat in the baseline ("and then my mum | and then Mum asked me") did not recur in later runs.

Still imperfect:
- "se n'è andato" (masculine participle = he) is now rendered "they": safe, but loses information the source gave.
- Name collision: with "Mia" saved as a call word, run 2 gave "mia mamma" -> "Mia's mum" and kept "Mia nonna". A line now says "mia" before a family word is "my"; run 3 was correct ("Mum's calling me", "Nonna made lasagne") but this is fragile.
- Small additions: "Love you too, you pain in the neck" ("too" not said).

Shared code suggestions:
- Name hints in server/refine.ts (<their_names_and_words>) should not apply when the saved name is also a common word of the source language and is followed by a noun ("mia mamma", Portuguese "Ana" is safe, Italian "mia/Mia", Spanish "mia"). Suggest: skip the hint when the lower-case form is the token in the source and the next word is a known family word or noun.
- `JOINING` has no Italian: add "il", "lo", "gli", "un", "una", "uno", "di", "del", "della", "che", "per", "mia", "mio", "tua", "suo" (cuts like "prendere una | pizza", "mia | mamma").
