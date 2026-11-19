# Gujarati (gu): eval notes

3 runs. `server/slang/gu.ts` was an empty stub; now ~25 KB, 8 groups, 174 terms (Kathiyawadi and Surti notes, "-ભાઈ/-બેન" name suffixes, Navratri/Uttarayan, Gujarati snacks).

What was wrong at first (run 1 → run 3):
- Ergative gender guessed: "એણે મેસેજ જોઈને રિપ્લાય જ ના આપ્યો" → "She read the message" → "They saw the message and didn't even reply"; and the opposite case "બોસે પકડી પાડ્યો" (object agreement shows "him") → "caught her out" → "caught them out" / "caught him out".
- Name suffixes: "રમેશભાઈ ..., પ્રિયાબેન સાથે" → run 2 "Ramesh bhai ... Priya ben" → "Ramesh came by, with Priya".
- Softener misread: "સારું બાબા સોરી" → "Alright babe, sorry" → "Alright, sorry".
- "lakh" kept in run 2 ("one and a half lakh") → "150,000"; "જમીને જજે" → "go after we've eaten" → "eat before you go".
- Into Gujarati: "તમે" to a partner and doubled "no worries" phrases → "વીકેન્ડમાં કંઈ ખાસ કર્યું?", "કંઈ વાંધો નહીં ભાઈ, થઈ જશે".

Still imperfect:
- "એનો પગાર" (masculine noun) still read as "His"/"Her salary" (owner's gender guessed from the possessive ending).
- Long speech: phrases cut after "ગઈ | હતી" and before "અને" give "with Mum was with Mia" (run 1) or "got engaged, and and she hadn't told anyone" (run 3).
- Kathiyawadi "હું કરે સે" (= what are you doing) and "હું મજામાં સુ" were understood every time.

Shared-code suggestions:
- `server/refine.ts`: add `[/\p{Script=Gujarati}/u, ["gu"]]` to `SCRIPTS` so Gujarati left in a subtitle is caught.
- `server/pipeline.ts`: an auxiliary ("હતી", "હતો", "છે") must stay with the phrase before it, and a phrase should not end on "અને" / "કે" (the repeated "and" at the join comes from both sides translating it).
