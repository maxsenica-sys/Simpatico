# Thai (th): evaluation notes

Three runs. `server/slang/th.ts` went from a 4-line stub to about 30 KB with 10 groups. It adds a separate pronouns-and-address group (เค้า/ตัวเอง between couples, พี่/น้อง as I or you, กู/มึง), plus particles, couples, youth slang, idioms, swearing, food and places, "how it is really spoken" and "Into Thai". It also has 164 terms. `leftIn` is empty because Thai script left in the output is caught automatically.

Run 1 was already good on single sentences. What was wrong, shown as before → after:
- "อิจฉาเพื่อนอะ แฟนมันหล่อมาก": "Jealous of your mate, babe" → "I'm so jealous of my friend". The fix was a note that เพื่อน with no owner means my friend, and that no pet names should be added.
- "พี่มิวถามว่า..." gave "Mia's asking", because the model matched the call name Mia. It now gives "Mew's asking". The reference's own example had been wrong here.
- "แม่ถามว่า ... ไหม" became the question "Is Mum asking if...?" in run 2. It is now "Mum's asking if we're going home ...".
- From English, "You're a legend, thanks for picking me up" was "ตัวจริงเลยที่รัก ..." (adding ที่รัก), then "เก่งสุด ๆ ที่มารับ". It is now "สุดยอดเลย ขอบคุณมาก ๆ ที่มารับนะ". "on the weekend" (past) was "เสาร์อาทิตย์นี้" and is now "เสาร์อาทิตย์ที่ผ่านมา".

Still imperfect:
- The long passages are poor every run. The test and phrase path cut Thai into fixed 18-character pieces, often in the middle of a syllable (แ|วะ, ม|า). Phrases come back empty, repeated ("ag Bangkok next month?") or with the wrong owner ("my sister, the babe's").
- "แล้วแต่ตัวเองเลย" sometimes adds "babe". That is close, because ตัวเอง is a couple's "you".
- After the gender check, Mum sometimes becomes "they".

Suggested changes to the shared code:
- `server/pipeline.ts` (and the phrase cutting copied in `scripts/langeval.mjs`): for languages written without spaces (th, and likewise lo, km, my, ja, zh), cut on word boundaries using `Intl.Segmenter(lang, { granularity: "word" })`, never by character count. As a minimum, never cut before a Thai combining vowel or tone mark, or after a leading vowel (เ แ โ ใ ไ).
- Gender check: แม่, พี่สาว, ยาย and similar words in the source count as the gender being given.
