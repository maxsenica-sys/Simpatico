# Tagalog / Taglish (tl): evaluation notes

Three runs. `server/slang/tl.ts` went from a 6-line stub to about 23 KB with 9 groups, including Taglish verb forms, "how it is really spoken" and "Into Tagalog". It also has 158 terms. `leftIn` leaves out words that are ordinary words in English or Spanish ("ate", "lang", "pala", "grabe", "pare", "tito", "ewan").

What went wrong at first, shown as before → after:
- "Seen lang ako ng seen, ni-reply wala": run 2 returned a whole explanation instead of a subtitle ("'Seen' is a loaded chat word here, and ... In casual Australian English: ..."). Run 3 gives "They just left me on read, not a single reply."
- "Ate, magkano po yung halo-halo?": "How much is the halo-halo, ate?" → "Excuse me, how much is the halo-halo?". "Lola" was kept as a word and is now "Grandma".
- "Kumain kana ba anak?" gave "babe" and now gives "sweetheart". "Sana all may jowa" gave "I wish everyone had a boyfriend" and now gives "Must be nice having a partner". "Kapal ng mukha niya" gave "Their face is so thick" and now gives "the nerve of them".
- From English, "Did you just leave me on read?" was two clumsy sentences ("Nag-leave ka ba sa akin sa read? Na-read mo lang...") and is now "Sineen mo lang ako?"

Still imperfect:
- The speech-recognition sentence "Ka si naman, ... na na man pala si Max" is still misread. In run 1 the model also wrote commentary about it, the same failure as the "seen" line above.
- In the long passages, the cut after the name marker "si" ("kasama si | Ate ...") loses "Ate" or turns it into "the sister". Words are doubled where phrases join ("the the", "to to", "have you're"). "Mama ... magluluto daw siya" becomes "they're cooking" after the gender check.
- "pasalubong" is sometimes kept as it is.

Suggested changes to the shared code:
- `server/refine.ts`: reject or retry any output that comments on the translation instead of giving a subtitle. Signs of this are quoted source text plus words like "means", "render", "In casual ... English", or output much longer than the source. This happened twice with Taglish.
- `server/pipeline.ts` JOINING: add Tagalog function words that never end a phrase: si, kay, ni, sa, ng, nang, ang, yung, mga, na (as a linker), at, kasi, pero, tapos, para, kung, kapag, pag.
- Gender check: treat "Mama", "Nanay", "Lola", "Ate" (and "Papa", "Kuya", "Lolo") in the source as the gender being given.
