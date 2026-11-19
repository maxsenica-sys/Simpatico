# Albanian (sq): langeval notes

3 runs. The reference started as an empty stub. It is now about 25 KB: 8 groups, 27 `leftIn`, 203 `terms`. It covers standard (Tosk) Albanian plus Gheg and Kosovo forms.

**Wrong at first (then fixed):**
- "E pa mesazhin dhe s'u përgjigj, më la në seen" → "She saw the message…" (a guess) → now "They saw the message…".
- "E dashura ime bëri tavë kosi" → "My love made tavë kosi" (runs 1–2) → now "My girlfriend made tavë kosi".
- "Qysh je, qka po bon tash?" (Kosovo Gheg) → "Good, how about you, what are you up to now?" (run 2: it answered the question instead of translating it) → now "How are you going, what are you up to now?".
- From English, run 1:
  - "it's so annoying" → "është shumë e mërzitshme" (boring) → now "sa bezdi".
  - "Mum" → "Mamaja" → now "Mami".

**Correct from the start:**
- The three uses of "po": "po vij" → I'm coming, "po të vish" → if you come, "po" → yes.
- Times: "tetë e gjysmë", "nëntë pa një çerek", and "një e gjysmë", even across a phrase cut.
- Spelling without diacritics: "fale minderit shum per gjithcka" → thanks so much for everything.
- Idioms: jam copë, u bëmë tapë, më ka ardhur në majë të hundës, i hipën nervat.
- Swears at the right strength.
- From English: "ti", "zemër", "je legjendë", "jam copë nga lodhja", and "treni u prish" for "stuffed".

**Still imperfect:**
- "sweet as" → "Kjo është (shumë) mirë", which is stiff. "Super!" would be natural.
- The admirative "Qenka çmendur!" → "it's gone mad". That is acceptable, but the surprise tone is weak.
- The model sometimes adds a "mate" that was not said: "Mate, it's gone mad!", "thanks mate".
- PHRASE mode:
  - "në atë | lokalin" → "that | the place". "dhe po | bën byrek" loses or doubles "she's making".
  - "e tha një | budallallëk" → "said something | stupid thing".
  - Run 3 put "Mum" in quotes in the first phrase.

**Suggested shared-code changes (not made):**
- `server/pipeline.ts` JOINING: add Albanian words that lean forward: dhe, e, por, që, se, në, me, për, te, tek, nga, po, do, të, një, atë, atë, kur, nëse, kështu. "po", "do" and "të" belong to the verb after them. "një" and "atë" belong to the noun after them.
- `server/refine.ts` phrase prompt: forbid adding an address word ("mate") that is not in the source. It appears in sq, el and hu.
