# Deep translation pass: brief for each language

Simpatico translates live speech between two people (video calls and "In person"). Speech is
transcribed by Soniox, then translated by Claude Haiku using a system prompt plus a per-language
reference: `server/slang/<lang>.ts`. Your job: make that reference excellent for your languages,
and prove it with real translations, the way Turkish was done.

**The standard to match: `server/slang/tr.ts`** (read it first, all of it). Note especially the
last two groups ("how it is really spoken", "Into Turkish (from English)") and the `leftIn` list.
Also read `server/slang/types.ts` (fields: `groups`, `leftIn`, `terms`).

## For each of your languages

1. **Write or extend `server/slang/<lang>.ts`.** Many are empty stubs. Aim for roughly the depth of
   Turkish (15–30 KB), real, current, widely used words only, with the meaning a listener needs.
   Groups (label each like `"Spanish, youth and online"`):
   - everyday spoken words, particles, fillers, greetings, thanks, sorry, OK, terms of address
   - affection, couples and family (how partners, parents, relatives are addressed)
   - youth and online slang
   - idioms and set phrases that must NOT be translated literally (give the meaning)
   - swearing and insults with strength noted
   - everyday culture: food and drink (keep dish names), places, sport, regional words
   - **"<Language>, how it is really spoken"**: clipped/colloquial forms, how speech recognition
     tends to split or misspell words, grammar traps for translation into English (dropped
     subjects, gender, formality T/V, verb position, aspect, particles), regional variants
   - **"Into <Language> (from English)"**: register for partners/friends/family, natural
     equivalents for casual English and Australian phrases (heaps, reckon, arvo, no worries,
     can't wait to see you, you're a legend, grab takeaway, leave on read, knackered…), and
     what sounds stiff/bookish to avoid
   - `leftIn`: fillers/particles/address terms that must never be left untranslated in an English
     subtitle. ONLY words that are not also ordinary words in other languages written in the same
     letters (e.g. no "no", "va", "da"). Non-Latin scripts: leave `leftIn` short or empty (text in
     the wrong script is caught automatically).
   - `terms`: 100–200 words speech recognition should expect: everyday spoken forms, slang,
     family words, food, cities/places, common first names, sport (written as natives write them).
   Line format: `'"term", "variant" = meaning (note)'`. Watch quoting: the file must stay valid TS
   (check with `npx tsx -e 'import("./server/slang/<lang>.ts").then(m=>console.log(m.default.groups.length))'`).

2. **Write `test/langeval/<lang>.json`** (format in `scripts/langeval.mjs`): 25–30 `to_en`
   sentences as people really speak (casual, couples, family, slang, emotion, clipped forms,
   numbers/times, names "Ezgi"/"Mia"/"Max", plus 3–4 with typical speech-recognition errors);
   8–10 `from_en` casual Australian English sentences; 2 `long` run-on stretches (35–60 words).

3. **Run** `node scripts/langeval.mjs <lang> test/langeval/<lang>.json` (about 30–60 s; it runs
   on a separate test machine with the real translator and YOUR local file). Judge every line as
   a strict native editor: meaning right? natural and the right register? anything left in the
   source language? a guessed he/she the source didn't give? idiom taken literally? words
   repeated or lost where phrases join (PHRASE/WHOLE lines)? FIX lines show the built-in checks
   correcting something.

4. **Fix the reference and re-run** (2–3 runs per language; stop when only minor issues remain).

5. **Write `test/langeval/<lang>.md`**: 10–20 lines: what was wrong at first (2–4 examples,
   before → after), what is still imperfect, and any change you think the SHARED code needs
   (prompt rules in `server/refine.ts`, phrase cutting in `server/pipeline.ts`) — describe it,
   don't make it.

## Rules
- Edit ONLY `server/slang/<lang>.ts`, `test/langeval/<lang>.json`, `test/langeval/<lang>.md`
  for YOUR languages. Other agents are editing other languages at the same time.
- Do not commit, push, deploy, build, or run the full test suite. Do not touch the Fly app
  except through `scripts/langeval.mjs`.
- Time box: about 75 minutes for all your languages. If running short, every language must at
  least have a solid reference file and one evaluated run.
- Final reply: one line per language: `<lang>: <runs> runs, <one-line verdict>, <main remaining issue>`.
