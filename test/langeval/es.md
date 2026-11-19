# Spanish (es): deep pass

Reference rewritten and extended from 11.7 KB to about 34 KB: new groups for everyday words and greetings, affection and family, food, places and sport, "how it is really spoken" and "Into Spanish". The regional groups (Spain, Mexico, Argentina, Colombia, Caribbean, Chile) are kept. There are now 162 `terms` and a wider `leftIn` list. Three evaluated runs plus a baseline with the old file.

What was wrong at first (baseline → run 3):
- "che boludo, ¿vamos a tomar unos mates…?" → "want to have some **mates**" → "want to have some mate".
- "gordo, ¿me pasas a buscar…?" (a woman to her partner) → "**Mate**, can you pick me up" → "Babe, can you pick me up".
- "ya voy, ya voy" → "**Yeah, yeah**" → "Coming, coming".
- "¿neta te dejó en visto?" / "mi ex con su nueva novia" → "did **he**…" / "my ex … with **her**" → "did they…" / "with their new girlfriend".
- "perdí el último metro" → "the last **tram**" → "the last metro".
- From English: "simplemente pedimos comida para llevar" (stiff) → "creo que mejor pedimos algo de comer"; "voy con retraso" → "llego tarde".

Still not perfect:
- "le dije que no, pero igual viene": comes out as "they're coming anyway". That is right for Argentina and Chile but wrong for Spain and Mexico ("they might come"). The sentence really is ambiguous.
- The long-sentence test cuts "fui a ver | a mi madre". The second piece comes back as "to see my mum", and only `dropRepeat` saves the result. One run lost a whole phrase ("a otro lado a echar unas chelas" → empty).
- "hasta | las tres" sometimes gives "until at three".

Changes the shared code may need (not made):
- `server/refine.ts`: the translator sometimes corrects itself in the output. Twice, FROM_EN "knackered … massive arvo" returned "…en el trabajo... no, let me correct: "Estoy reventado…"". A check could strip text from "let me correct" / "no, " + quote onwards, or reject any output that contains English meta-words when the target is not English.
- `server/pipeline.ts`: in Spanish, `joinsForward` should also hold back "a" (personal a / "ir a ver a"), "con su", "hasta", "qué" and "a otro". These come before what they belong to.
- Phrase prompt: when a phrase repeats what is already shown, it should return only the new part, never an empty string.
