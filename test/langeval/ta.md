# Tamil (ta): deep pass, 3 runs

The reference went from an empty stub to about 28 KB:
- everyday words, couples and family, youth and online, idioms, swearing with strength noted
- food and culture, including Sri Lankan Tamil (கதைக்க, ஓம்)
- "how it is really spoken": spoken vs written forms, person and gender in the verb, அவங்க = they or a respected person, negation inside the verb, -ஆம் = apparently, times, Tanglish
- "Into Tamil": spoken register, "miss" = மிஸ் பண்றேன் (never இழக்கிறேன்), நாங்க vs நம்ம
- 139 recognition terms

`leftIn` holds Tamil-script fillers and address words. Tamil script is not in the SCRIPTS table in refine.ts, so these words are the only thing that catches Tamil left in an English subtitle.

What was wrong at first, before → after:
- "கோவிச்சுக்காதே கண்ணம்மா" → "Don't be cross with me, Mia" (a pet name read as the saved name) → "Don't be cross with me, babe".
- "அம்மா ரொம்ப | நாளா … சொல்லிட்டே இருக்காங்க" → "Mum's been | missing you" (made up) → "Mum's been | for ages been saying come home". The meaning is right now, but the join is clumsy.
- "We had heaps of fun at the beach" → "நம்ம பீச்ல…" (we, including the listener) → "நாங்க பீச்ல ஜாலியா இருந்தோம்".
- Final phrase "… தலை நிமிர கூட நேரம் கிடைக்கல" came back empty, so the subtitle ended "so the whole day". It is now translated ("didn't even get time to look up").

Still not right:
- "அவங்க நேத்து வரல" often comes out as "She didn't come". அவங்க is "they", or a respected person of either sex.
- Address words ignore the listener's gender: "சாரி டா" and "வேற லெவல் டா" were said to a woman, and "machaan" is added where the English had no "mate".
- "சாயங்காலம்" (evening) still becomes "this arvo".
- The verb seen in next_words gets written twice: "the metro stopped halfway | stopped".

Changes the shared code needs:
- `server/refine.ts` SCRIPTS: add Tamil, Telugu, Kannada, Malayalam, Gujarati and Gurmukhi, so script left in an English subtitle is caught.
- `server/refine.ts`: Tamil, Telugu, Kannada and Malayalam have a respectful plural (அவங்க, వాళ్ళు/వారు, ಅವರು, അവർ) that gives no gender. Add a pronounTag-style reminder for these languages ("a -ஆங்க/-ారు/-ರು verb or அவங்க-type pronoun is 'they' unless the conversation names the person"). Also run the gender check for them.
- `server/pipeline.ts`: add a Dravidian list of words that lean forward, for joinsForward: ரொம்ப, ஒரு, அந்த, இந்த, என்ன, அவ்வளவு, எவ்வளவு, ஆனா, நீ/நான் at a phrase end. Cutting after them causes most PHRASE/WHOLE errors.
- PHRASE_SYSTEM: the "write the verb from next_words" exception makes the verb appear twice. When the previous phrase used it, mark it in `shown` or the next phrase, so the translator knows to skip it.
