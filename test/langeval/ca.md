# Catalan (ca): deep pass

New reference (stub → about 23 KB): everyday, affection and family, youth and online, idioms, swearing, food and festivals (with Valencian and Balearic notes), "how it is really spoken" and "Into Catalan". It has 143 `terms` and 19 `leftIn`. Three evaluated runs plus a baseline with the empty stub.

What was wrong at first (stub → run 3):
- Catalan quarter-hour times were wrong. "dos quarts de vuit" → "quarter to eight" → "half seven". "un quart de deu" → "quarter to ten" → "quarter past nine".
- "estic fins al capdamunt del meu cap" → "**flat out like a lizard drinking**" → "I'm so fed up with my boss".
- The periphrastic past was read as present or future. "no sé si va venir" → "if she's **coming**" → "if they came".
- "home, no fotis" → "mate, **don't stuff around**" → "Oh come on, you're kidding".
- From English: "Estic **fotut**" (screwed or ill) → "Estic rebentat". "deixar-me en **"read"**" and "**Li** ha tornat a deixar" → "M'ha tornat a deixar en vist". "**cariño**" (Spanish) → "amor". "No problem mate, crec…" (English left in) → "Cap problema, tio, crec que millor…".

Still not perfect:
- Gender is still guessed. "l'he vist" → "I saw her"; "t'ha tornat a deixar en vist" → "did she…"; and in the phrase-by-phrase test, "el meu ex amb la seva nova xicota" → "with **his** new girlfriend".
- "Déu n'hi do quina cua" → "Bloody hell, …" (too strong; it means "wow, what a queue").
- Long sentences break badly at the joins. "com tres | hores" lost "three" or produced "…hours" with ellipses. "se'm va | fer tardíssim" duplicated "it got late". "arribo | a la festa" lost "the party". "fins | a les tres" → "until at three".

Changes the shared code may need (not made):
- `server/pipeline.ts` `joinsForward` for ca: hold back the past auxiliary "vaig/vas/va/vam/vau/van" (it is always followed by an infinitive). Also hold back weak pronouns ("em", "et", "es", "se'm", "se't", "l'", "m'", "t'"), "com" + number, "fins", and the personal articles "en" and "la" before a name.
- Phrase prompt: apply the "never guess he/she" rule as strongly in phrase mode as in `refine`. Ask for no "..." and no ellipses at the edges of a phrase.
