# Portuguese (pt): deep pass

Runs: baseline (old 11 KB file) + 3 runs with the new reference (25 KB, 12 groups, 175 terms; Brazil default, Portugal noted).

What was wrong at first (before -> after):
- Dropped subject turned into "you": "Me deixou no vácuo o dia inteiro" -> "You left me on read" -> "(They) left me on read".
- "de repente" (BR = maybe) taken literally: "de repente agente se vê amanhã" -> "All of a sudden we'll see each other" -> "Maybe we'll catch up tomorrow".
- Into Portuguese, "mate" became a pet name and stiff grammar: "No worries mate, you're a legend" -> "Sem problema, amor, você é um anjo" -> "Relaxa, cara, você é demais"; "Nós nos divertimos muito" -> "A gente se divertiu pra caramba".
- Repeated idea: "foi uma lavada" -> "three goals to none. It was a proper belting" (now one phrase most runs); "tô pistola" -> "I'm so over it" -> "I'm fuming/so annoyed".

Still imperfect:
- Swearing toned down sometimes ("pra caralho" -> "so late"); "ó pá" (PT-PT) comes out as "Oi" (Aussie attention-getter), acceptable but not ideal.
- PHRASE lines: words cut at a phrase edge get lost or doubled: "demorou pra | caramba" -> "took ages to | and when"; earlier runs gave "my mum | Mum was", "umas seis | e pouco" -> "around six | just after six".

Shared code suggestions:
- `JOINING` in server/pipeline.ts has no Brazilian contractions: add "pra", "pro", "pros", "num", "numa", "no", "na", "nos", "nas", "pelo", "pela", "meu", "minha", "umas", "uns", "já", "não" so a phrase is not cut right before its noun or "caramba".
- `dropRepeat` (server/text.ts) only catches exact repeats; "my mum" + "Mum was" and "around six" + "just after six" slip through. Comparing case-folded last 1-3 content words of `shown` with the first ones of the new phrase would catch these.
