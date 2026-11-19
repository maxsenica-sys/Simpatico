# English (en): Australian, British, American. 4 runs (2 into Spanish, 2 into French)

How it was tested: `test/langeval/en.json` has 18 casual English sentences, mostly Australian, run with `langeval.mjs es` and `langeval.mjs fr`. **Caveat:** the harness uploads only `server/slang/<lang>.ts` for the language it is given. These runs therefore used the DEPLOYED en.ts plus my local fr.ts (or the es.ts another agent is editing). My en.ts edits are NOT exercised by these runs.

en.ts changes (21 KB → 31 KB):
- 4 new groups: affection/couples/family; "English, how it is really spoken" (dropped subjects, "she" = it, "you" plural, mishearings of arvo / no wukkas / Maccas / esky, half seven, understatement, interjections); "Out of English" (no worries, my shout, chuck a sickie, crook, spewin', dag, leave on read); and "Into English" (regional register, no stereotyped Aussie slang, match swearing strength).
- `leftIn` extended. 179 `terms` added; there were none before.

What the deployed en reference got wrong:
- Into Spanish: "No wukkas" → "No problem" / "No problema" (English left in, both runs).
- "My shout this arvo" → "Mi turno esta tarde" (meaning lost; the second run got "Yo invito").
- "a bit of a dag" → "un poco torpe" / "excentrique" (should be dorky). French is fixed through fr.ts: "un peu ringard".
- Into French: "Ugh" was left in English. Fixed via fr.ts: "Pff".

Understood well: yeah nah / nah yeah, knackered, flat out, spewin' (vénère / estoy que trino), chuck a sickie (se faire porter pâle), left on read, rellies, thongs, servo, Maccas, half three, crook.

Still imperfect: "esky" → "cooler" in Spanish once; "chuck a sickie" in Spanish comes out wordy.

Shared-code suggestion: let `scripts/langeval.mjs` also upload `server/slang/en.ts` whenever the other side of the call is English (it always is in this harness). Otherwise English reference changes can't be evaluated.
