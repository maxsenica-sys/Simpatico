# Indonesian (id): evaluation notes

Three runs. `server/slang/id.ts` grew from about 10 KB to about 25 KB. It has new groups for particles, idioms, everyday culture and food, "how it is really spoken" and "Into Indonesian", plus 154 terms. The `leftIn` list is wider, but common words in other languages are kept out ("kok", "dong", "lo", "aja", "coy").

What went wrong at first, shown as before → after:
- "kamu pasti capek bang get" (speech recognition split "banget"): "You must be knackered, mate" → "You must be so tired".
- "mama udah nanyain ... katanya mau masak": "mum ... they say they want to cook" → "Mum ... she says she wants to cook". "adek aku" was "my sister" (a guessed gender) and is now "my little sibling". "pacar kakaknya" was "your boyfriend" and is now "their big sister's boyfriend".
- "yaudah deh pulangnya aku beli seblak": "so I just went home so I bought seblak" → "so on the way home I bought seblak".
- "Ciee yang baru jadian, traktir dong": "the newly-weds-to-be treat us" → "Ooh, look who's just got together, so shout us then!"
- From English, "Love you, miss you heaps" became "Sayang, kangen banget", which lost "love you". It is now "Sayang kamu, kangen banget". "Grab takeaway" no longer adds "GoFood", and "leave me on read" is natural now ("Kok cuma di-read doang sih?").

Still imperfect:
- "mager" keeps coming out as "I'm so lazy" rather than "I can't be bothered".
- "receh banget" comes out as "so cheesy", and one run added an emoji (😂).
- "healing ke Bali" is sometimes left as "healing".
- "Gimana kabarnya Max?" is ambiguous: it can mean "how's Max?" or "how are you, Max?". The model always picks "how are you, Max".
- In the long passages, a phrase sometimes translates words from the look-ahead before they arrive: "and she's curious to meet you" appeared one phrase early, then again later. A joining word is also sometimes doubled ("so on the way home so I bought").

Suggested changes to the shared code:
- `server/refine.ts` (phrase prompt): tell the model that `ahead` is only for context and must never be translated in this phrase. Also, drop a leading "so"/"and" when the text already shown ends with the same word.
- Gender check: a family word in the source (mama, ibu, papa, bapak, kakak perempuan) should count as the gender given. Run 1 showed `gender_check` turning mum's "she" into "they".
- Emoji in the output should be stripped, or ruled out in the prompt.
