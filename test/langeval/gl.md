# Galician (gl): deep pass

New reference (stub → about 22 KB): everyday, affection and family, youth and online, idioms, swearing, food and festivals, "how it is really spoken" (contractions, enclitic pronouns, "che", no compound past) and "Into Galician" (Galician rather than Spanish or Portuguese forms, enclitic placement). It has 147 `terms` and 20 `leftIn`. Three evaluated runs plus a baseline with the empty stub.

What was wrong at first (stub → run 3):
- "non pasa nada, cariño, tranquila" → the translator's own **meta-commentary** ("— spoken to someone (Max or Ezgi as listener…") → "No worries, babe, relax".
- "malo será, muller" → "**Hard to say**, mate" → "it'll be fine, mate".
- "xa che dixen que non" → "**I've already been told** no" → "I already told you no".
- "es que non se si veu ou non" → "I don't know if **you can see it**" → "I don't know if they came or not".
- From English: "**Non podo esperar** para verte" (calque) → "Que ganas teño de verte". "**boto** moito de menos" → "bótote moito de menos". "simplemente collemos" → "coido que mellor pedimos". "Tranquilo" (to a woman) → "Tranquila".

Still not perfect:
- "vino no bar" (= I saw him in the bar) still comes out as "He came into the bar" in all three runs. The Spanish reading of "vino" wins even with a dedicated line in the reference.
- In "…veu ou non, por que non me dixo nada", "por que" is still read as "why?" instead of "because".
- Gender is guessed in phrase mode: "o meu ex coa súa nova moza" → "his new girlfriend".
- "estou rebentada" → "I'm stuffed": in Australian English that can also mean full. "A nai di…" is missing "miña".
- Long sentences: "como tres horas | despois" → "Three hours after lunch"; "así | que" → "so so"; "chegou | a Mia" → "Mia showed up and Mia and I…" (repeated).

Changes the shared code may need (not made):
- `server/refine.ts`: reject or strip outputs that contain notes about the translation (a dash followed by "spoken to", "listener", or a quoted rationale). One appeared here, and Spanish had a "let me correct" leak.
- `server/pipeline.ts` `joinsForward` for gl: hold back "así", "como" + number, "chegou/veu/foi" + article, and the articles "o"/"a" before a capitalised name (a subject after the verb).
- Possibly pass Galician through the translator with an explicit "this is Galician, not Spanish" line in the system prompt, because Haiku reads look-alike words with their Spanish meaning.
