# Marathi (mr): eval notes

2 runs. `server/slang/mr.ts` was an empty stub; now ~27 KB, 8 groups, 161 terms.

What was wrong at first (run 1 → run 2):
- Insult dropped: "तो चुत्या परत लेट आला" → "He turned up late again" → "That bloody idiot showed up late again" (still a notch soft).
- "आयला" read as an address term: "Oh mate, I didn't even think about that" → "Whoa, I didn't even think of that".
- Into Marathi, "too easy" taken literally: "अगदी सोपं आहे" → "होऊन जाईल"; "I miss you" as "आठवण काढतोय" → "तुझी खूप आठवण येतेय"; Latin "love you" left in → "लव्ह यू".

Good from the start: "आलेच" (back in a sec), "चल येते मी" (I'm off, not "I'm coming"), "आपण" as "we/let's", "रुसू नको" (don't sulk), Kolhapuri/rural clipped forms ("मी ठीक हे तू सांग कसा हेस"), gender from verbs ("दमले", "भेटले").

Still imperfect:
- "धन्यवाद" still chosen for "thanks" to a partner (should be "थँक्स"); "विमानतळ" fixed to "एअरपोर्ट".
- "जेवून जा" rendered "stay and have dinner" (closer: "eat before you go").
- Long speech: "सकाळपासून | मीटिंग" cut across phrases loses "meetings" ("since the morning no lunch on time"); the final one-word phrase "आहे" came back empty, which was fine.

Shared-code suggestions:
- `server/pipeline.ts`: for verb-final Indic languages, a phrase should not end on a time/place word whose noun follows ("सकाळपासून", "तिथे") nor start with an auxiliary ("आहे", "होतं"); let the auxiliary stay with the previous phrase.
