# Simpatico content queue: rules (checked by validate_queue.py)

One row per post in a CSV with exactly these columns, in this order:

post_id, feature_id, angle_name, audience, format, hook, old_way, cost, mechanic, change, ask, caption, hashtags, voiceover_script, pose_1, pose_2, pose_3, pose_4, pose_5, ui_card, tiktok_hook, tiktok_caption, tiktok_sound

## The spine (five beats, every post)
| Field | What it does | Words, at most |
|---|---|---|
| hook | An observation about real life across languages, never a product claim | 9 |
| old_way | What people do now | 9 |
| cost | What that costs them | 14 |
| mechanic | One feature, shown on the phone | 14 |
| change | What is now true | 14 |
| ask | One action | 7 |

Rules: one feature per post; pain opens, never the app; the mechanic shows the phone doing it; if it needs a sixth beat, split it.
The ask rotates across exactly three variants: "Try Simpatico free on iPhone." / "Send someone your call card." / "Link in bio. Talk to anyone."

## Fields
- post_id: S + three digits (your assigned range).
- feature_id: from features.csv, status shipped only.
- audience: couples | families | travellers | newcomers | friends | everyone.
- format: carousel | still | reel.
- caption (Instagram): first sentence weighted for search, naming the situation and the languages (e.g. "Talking to your Turkish mother-in-law without a translator."), then 2 or 3 short sentences. 60 words at most.
- hashtags (Instagram): exactly 5, each one word starting with #, last one #simpatico.
- voiceover_script: 25 to 50 words, first person, plain spoken English that travels (see Plain words), one speaker. No question marks, no superlatives (best, amazing, incredible, game-changer, revolutionary), no marketing voice.
- pose_1 to pose_5: from the pose list below (title card, old way, cost, mechanic, change).
- ui_card: ui-call-captions | ui-inperson-split | ui-home-callbutton | ui-call-card-share | ui-group-captions | ui-language-picker | ui-transcript
- tiktok_hook: the big text on the first frame on TikTok, 7 words at most, can differ from hook (punchier, curiosity first).
- tiktok_caption: 150 characters at most, starts with search words (the languages and the situation), ends with 3 to 5 hashtags including #simpatico. A question to invite comments is allowed here.
- tiktok_sound: "original voiceover" for reels and stills; for carousels (TikTok photo mode) "trending: <mood>" e.g. "trending: soft acoustic".

## Everywhere
- No em dashes or en dashes. No emojis.
- Australian spelling (colour, favourite, mum, organise, realise, travelling, centre). Never: color, favorite, mom, organize, realize, traveling, center.
- Only what the app really does today (features.csv, shipped). Never promise read-aloud, QR joining, prices or plans.
- Never name competitors.
- Real details make it believable: name the languages (Turkish, Vietnamese, Arabic, Hindi, Mandarin, Spanish, Tagalog, Korean, Greek, Italian...). Places only when everyone knows them.

## Plain words (checked by validate_queue.py where it can be)
Every line must be understood by someone reading English as a second language, and must survive being translated.
- Full, simple sentences: who does what. No fragments ("Forty minutes on the phone talking her through sign-up." becomes "You spend forty minutes explaining how to sign up.").
- Each line makes sense on its own, without the slide before it. Say who "she" is at least once per post: "your partner's mother", "your grandmother", "the plumber".
- Common words only. No idioms, no metaphors, no sarcasm, no jokes that need local knowledge. Not "the stories evaporate", "instant cathedral", "a hostage negotiation", "it's sorted", "falls through", "turns up".
- No Australian-only or regional words: tradie, sparky, ute, arvo, mate, footy, netball, heaps, reckon, nan, aunty. Say plumber, electrician, car, afternoon, friend.
- No family words from other languages (Nene, Yiayia, Lola, Teta, Baba, Nonna). Say grandmother, grandfather, mother, father.
- No invented names (Kostas, Mr Chen, Jiwoo) in the five beats: use the role ("your friend in Korea", "the pharmacist"). No small suburbs or towns; a country or a city everyone knows (Istanbul, Tokyo, Rome, Hanoi) is fine.
- Always name the two languages.
- The cost line says plainly what is lost. The mechanic line says what you do in the app and what happens, in the fewest steps. The change line says the benefit in human terms.
- Reuse the plain way of saying what the app does: "You speak your language. They read it in theirs." / "They tap a link. No app, no account." / "One phone between you. Each of you reads your own half." / "Up to 12 people. Everyone reads in their own language."
- Slang posts keep the slang, because it is the point, but only inside quotes, and the meaning is given plainly: "'Yeah nah' means no."

## Poses (fixed cast of 8)
traveller: traveller-lost, traveller-phone-up, traveller-laughing, traveller-pointing
grandma (Turkish nene): grandma-on-phone, grandma-confused, grandma-smiling, grandma-waving
grandkid: grandkid-waving, grandkid-reading-phone, grandkid-shrugging
partner-a (Australian man): partner-a-on-call, partner-a-confused, partner-a-laughing, partner-a-reading-phone
partner-b (Turkish woman): partner-b-on-call, partner-b-reading-phone, partner-b-laughing, partner-b-rolling-eyes
student (international student): student-homesick, student-on-call, student-studying, student-relieved
shopkeeper (market vendor): shopkeeper-talking, shopkeeper-pointing, shopkeeper-smiling
newcomer (new arrival, parent): newcomer-worried, newcomer-relieved, newcomer-reading-letter
pairs: two-people-one-phone, family-group-call, friends-cheers
