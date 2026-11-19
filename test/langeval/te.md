# Telugu (te): deep pass, 3 runs

The reference went from an empty stub to about 27 KB:
- everyday words, couples and family, youth and online (with Hyderabadi Dakhni), idioms, swearing with strength noted, food and culture
- "how it is really spoken": verb endings, -ఇంది = she OR it, -ారు = respected or plural, negation in the verb, -కు = don't, అంట = apparently, -దామని అనుకుంటున్నా = I'm thinking of, times, Tenglish
- "Into Telugu": register, మేము vs మనం, address words by gender
- 141 recognition terms

`leftIn` holds Telugu-script particles. Telugu script is not in the SCRIPTS table in refine.ts.

What was wrong at first, before → after:
- "నువ్వు ఊరికే బిల్డప్ ఇవ్వకు" → "You're not just showing off, mate" (the negative order was read as a statement) → "Don't just show off". Fixed by adding the "-కు = don't" rule.
- "ఈ సెలవుల్లో ఊరికి వెళ్దామని అనుకుంటున్నా" → "I reckon we should head home" → "I'm thinking of going home over the holidays".
- "Hey babe, can't wait…" lost "babe" → "హే బంగారం, …". "Did you get up to much" picked up a made-up "any plans?" → "ఈ వీకెండ్ ఏమైనా చేశావా?"
- "సాయంత్రం" (evening) still comes out as "this arvo", even with the rule in place.

Still not right:
- PHRASE/WHOLE is the weak point:
  - A phrase that ends on "నువ్వు" (you) and gets its verb in the next phrase comes out as "…, you | Come in December".
  - "చాలా | రోజులుగా" (for ages) comes out as "Mum's been really | been asking".
  - The verb read from next_words appears twice ("stopped halfway | stopped").
  - A made-up ending appeared once ("No time for lunch even").
- Into Telugu still uses "రా" and "బావ" to a female listener and adds "thanks".
- A kinship word was once left romanised in English ("Attha cooks superbly"). leftIn cannot catch romanised leftovers.

Changes the shared code needs:
- `server/refine.ts` SCRIPTS: add Telugu script (and Tamil, Kannada, Malayalam), so Telugu script left in a subtitle is caught.
- `server/pipeline.ts`: do not end a Telugu phrase on a bare subject pronoun (నువ్వు, నేను, మేము) or on a word that leans forward (చాలా, ఒక, ఆ, ఈ, ఎంత, అంత, కానీ). These cuts cause most of the PHRASE/WHOLE errors.
- PHRASE_SYSTEM or the people tag: say in plain words "the listener is a woman: no male address words (ra, bava, mama, machan, maga, da)". The current gender line is ignored for address particles.
- `leftovers()`: let a language list romanised kinship and address words (attha, amma, bava, machan) and check the English output for them even when the source is in another script.
