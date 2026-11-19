# Malayalam (ml): deep pass, 3 runs

The reference went from an empty stub to about 27 KB:
- everyday words, youth slang (adipoli, polichu, scene, chali, theppu, kalippu, pani kitti, chunk), couples and family (Hindu, Muslim and Christian kinship words), idioms, swearing with strength noted
- food: porotta-beef, sadya, kappa-meen
- Onam, Gulf, Kerala Blasters
- "how it is really spoken": verbs carry NO person or gender, ഞങ്ങൾ vs നമ്മൾ, negation after the verb, -ത്രേ = apparently, central Kerala -ുവാ, times, Manglish
- "Into Malayalam"
- 146 recognition terms

`leftIn` holds Malayalam-script particles. Malayalam script is not in the SCRIPTS table in refine.ts.

What was wrong at first, before → after:
- "അവനോട് ഇനി മിണ്ടില്ല, ഭയങ്കരമായി ഹർട്ട് ആയി" → "He's not talking to him again, he's really hurt" → "I'm not talking to him any more, I'm really hurt". Fixed with the rule that a subjectless verb describing the speaker's own feelings or refusals means "I".
- Long sentence, phrase 1 skipped its own words and translated only next_words ("stopped halfway, about half an hour"), then phrase 2 came back empty → "do you know what happened today? On the way to the office this morning, the metro | stopped, and I had to keep standing…".
- "നിന്നുകൊണ്ട് തന്നെ ഇരിക്കേണ്ടി വന്നു" → "had to sit there" → "had to keep standing".
- "Love you heaps, talk tomorrow yeah?" → "…, ശരിയല്ലേ?" ("isn't that right?") → "…, ഓക്കെ?"

Still not right:
- "Sorry" still comes out as the stiff "ക്ഷമിക്കണം" despite two lines asking for "സോറി".
- "mate" is added to English lines with no address word ("…if you were here, mate").
- "ബിൽഡപ്പ് ഇടണ്ട" (stop hyping it) came out as "don't stress it".
- One long sentence gained a made-up clause ("so he's been on my back all day").
- Malayalam gives the best PHRASE/WHOLE result of my five languages: the second long sentence came out clean.

Changes the shared code needs:
- `server/refine.ts`: Malayalam is the one Indian language here whose verbs never mark person. Add a pronounTag for "ml" saying "the verb doesn't say who; take the subject from the conversation, and the speaker's own feelings or refusals are 'I'". A rule placed next to the words is followed more reliably than the reference.
- `server/refine.ts` SCRIPTS: add Malayalam script.
- PHRASE_SYSTEM: next_words led phrase 1 to translate the NEXT phrase instead of its own. Add the rule "start from the first word of <new_phrase>, every time".
