# Kannada (kn): deep pass, 3 runs

The reference went from an empty stub to about 26 KB:
- everyday words, Bengaluru slang (maga, sakkath, swalpa adjust maadi, kai kotta), couples and family, idioms, swearing with strength noted
- food: darshini, benne dose, ragi mudde
- RCB and film stars
- "how it is really spoken": spoken vs written forms, the verb ending gives person and gender, -ರು = respected or plural, negation in the verb, ಅಂತೆ = apparently, times, Kanglish
- "Into Kannada", with a first-line rule on address words and the listener's gender
- 130 recognition terms

`leftIn` holds Kannada-script particles. Kannada script is not in the SCRIPTS table in refine.ts.

What was wrong at first, before → after:
- Into Kannada to a female partner: "ಲವ್ ಯೂ ತುಂಬಾ ಮಗಾ" (maga = dude) and "ಸುಸ್ತಾಗಿದೆ ಮಗಾ" → "ಲವ್ ಯೂ ತುಂಬಾ, ನಾಳೆ ಮಾತಾಡೋಣ ಆಯ್ತಾ?". Fixed once the rule went first in the group.
- "Sorry" came out as the stiff "ಕ್ಷಮಿಸು" → "ಸಾರಿ". "Hey babe" came out as "ಹೇ ಪುಟ್ಟ" (a word for a child) → "ಹೇ ಬಂಗಾರ".
- Long sentence, "ಮೆಟ್ರೋ ಮಧ್ಯದಲ್ಲೇ | ನಿಂತೋಯ್ತು" → "stopped in the middle of | tunnel and just sat there" (made up) → "stopped halfway | stopped". No more invention, but the verb still appears twice.

Still not right:
- PHRASE/WHOLE:
  - The verb read from next_words is repeated.
  - "ಆಮೇಲೆ ಆಫೀಸ್ | ಗೆ ಹೋಗಿ" is cut inside a word: the case ending "ಗೆ" got its own phrase. This gives "then the office | the boss…".
  - In the second long sentence, "I'm not going alone" is pulled forward from the final clause, so it appears twice.
- "ಸಂಜೆ" (evening) still comes out as "this arvo".
- To a female listener, "ಪರವಾಗಿಲ್ಲ ಮಗಾ" is still used once where the English had "mate", and unasked "thanks" is added.

Changes the shared code needs:
- `server/pipeline.ts`: the word splitter treats a case ending written apart by recognition ("ಆಫೀಸ್ ಗೆ", "ಡಿಸೆಂಬರ್ ಅಲ್ಲಿ") as a word, and a phrase can end just before it. Never start a phrase with a bare case ending (ಗೆ, ಅಲ್ಲಿ, ಇಂದ, ದು, ನಲ್ಲಿ; the same in Tamil ல, ஓட and Telugu లో, కి).
- `server/refine.ts` SCRIPTS: add Kannada script.
- PHRASE_SYSTEM: when the previous phrase already wrote the next phrase's first verb from next_words, it should say so in the prompt. Another option is to pass the words already covered, so the model does not write them twice.
- An "address words follow the listener's gender" line in the shared rules. It would help all the Dravidian languages, since the per-language line is only partly followed.
