# Belarusian (be): deep pass, 3 evaluated runs (+1 lost to a Fly rate limit)

The reference went from an empty stub to about 25 KB in 8 groups. It covers trasianka and Russian mixing, false friends with Russian (так = yes, зараз = now, час, гадзіна, нядзеля, сябар), Belarusian food (дранікі, мачанка, калдуны, бабка, халаднік), festivals and places, and times ("палова пятай" = 4:30, which came out right in every run), plus `leftIn` (transliterations only) and 170 `terms`.

What was wrong at first (run 1 → run 3):
- "Мы з Міяй сёння дранікі смажылі" → "We made potato pancakes with Mia" → "Mia and I fried draniki".
- From English, "Mum reckons we should come over for dinner Sunday arvo" → "…на абед у нядзелю пасля абеду" (lunch after lunch) → "…на вячэру ў нядзелю ўдзень".
- "She left me on read again" → "Ён зноў пакінуў мяне…" (she became he; run 2) → "Яна зноў пакінула мяне…".
- "I reckon we just grab takeaway" → "…, як думаеш?" (turned into a question) → "думаю, проста возьмем нешта на вынас".

Still imperfect:
- "мне трэба пяць хвілін и я выходжу" (an ASR-style Russian "и" inside Belarusian) came back as `null` in 2 of 3 runs. The subtitle is simply lost.
- "бабця" is left as "Babcia" even with an explicit "never Babcia" line; "Дык я ж табе казала" still comes out "So I told you" (should be "See, I told you"); "Ну такое" comes out "Eh, not much".
- "No worries mate" to a partner still gives "браце"; "Трасца" is translated "Damn", which is right.
- Joins lose or garble words: "…калі | вяселле" lost "wedding" entirely, and "стаю як | дурніца" → "like dork".

Suggestions for shared code:
- `server/refine.ts`: find out why refine returns `null` for a short, clear sentence with one mixed-script letter ("и" for "і"), and make a null or empty result retry once or fall back to the raw translation.
- `server/pipeline.ts` `JOINING`: add the Belarusian joiners ("і", "ў", "у", "з", "што", "калі", "як", "бо", "а", "але") and kinship words before a name (цётка/цёткай), so phrases stop ending on "як" or "калі" and dropping the next word.
- A shared prompt rule that a word for grandma, mum and so on in any language becomes the English word (Gran, Mum) and is never kept or swapped for another language's form ("Babcia").
