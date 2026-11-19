# Afrikaans (af): langeval notes

Runs: 3. Reference went from empty to about 25 KB (8 groups, 158 terms). It covers the nie…nie double negative, the particles mos, darem, sommer, nogal and nè, and Oom/Tannie address. It also covers SA English carry-overs (now-now, just now, shame, robot), Kaaps forms, braai and rugby culture, and loadshedding.

What was wrong at first (before → after):
- "Dankie, Oom, dit was baie lekker kos" → "Thanks, mate, …" in runs 1 and 2 → "Thanks, Uncle, …". It needed an explicit rule in the "how it is really spoken" group: never "mate" for Oom or Tannie.
- "Siestog, … sterkte vir haar" → "good luck to her", then "hang in there for her" → "Aw, poor thing, she broke her leg. Send her my love."
- "Toemaar, 'n boer maak 'n plan" → "Nah, she'll be right, …" (wrong tone, and the same idea twice) → "Don't worry, we'll figure something out".
- "Jislaaik bru" → "Crikey mate" → "Geez mate". The shared English reference pulls South African speech into Australian.
- "Ek het darem my werk klaar gekry" → "I finally got…" → "At least I got my work done".
- FROM_EN "Het jy my op gelees los?" (bad past tense) → "Het jy my op gelees gelos?".

Still imperfect:
- The long run-ons are the weak spot. In "… het sommer net aan | die slaap geraak ek is jammer ek sal dit | regmaak …", the middle phrase comes back empty and "I'm sorry" is lost. The last phrase "eet" also comes back empty, and earlier it turned "uit eet" (go out for dinner) into "go out and have a good time".
- "nou het | ek drie stukke" once came out as "now she has", which guesses the wrong subject because of the inverted verb-second order.

Shared code suggestions (not made):
- `server/pipeline.ts` JOINING has no Afrikaans words. Add en, maar, omdat, dat, as, of, die, 'n, aan, uit, by, met, vir, na, het, is, sal, moet, wil. Afrikaans, Dutch and German all put the verb or verb particle last ("aan die slaap raak", "uit eet", "saamvat"). Do not end a phrase on a preposition, separable particle or auxiliary.
- `phraseTranslate` should never return empty for a non-empty phrase that contains content the shown text has not covered ("ek is jammer"). If the model folds the next words in from `ahead`, the following phrase must still translate what was not yet said.
