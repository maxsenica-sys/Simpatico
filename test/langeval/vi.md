# Vietnamese (vi): evaluation notes

Three runs. `server/slang/vi.ts` went from a 4-line stub to about 25 KB with 9 groups. These cover kinship pronouns, particles, couples and family, youth slang, idioms, swearing, food and places, "how it is really spoken" (north and south, speech recognition dropping tone marks) and "Into Vietnamese". It also has 171 terms.

What went wrong at first, shown as before → after:
- "Em gato với con bạn em": "jealous of your friend" (run 1) → "my friend's kid" (run 2) → "my friend" (run 3). The fix needed two notes: "bạn em" from an "em" speaker means MY friend, and "con" before "bạn" is the southern word for a girl, not a child.
- From English, "You're a legend, thanks heaps for picking me up", said by a man: "Em đỉnh quá, cảm ơn anh ... vì đã đón em", with the pronouns swapped → "Em đỉnh quá, cảm ơn em ... vì đã đón anh".
- "Hey babe, can't wait to see you" came out as "nhớ em quá" (I miss you) and is now "nóng lòng gặp em chiều nay quá".
- Long passage: "ướt hết trơn" came out as "slippery" and is now "completely soaked". "bạn trai của chị nó" came out as "your boyfriend" and is now "her big sister's boyfriend".

Still imperfect:
- From English, a man saying "Love you, miss you heaps" or "Sorry I'm running late" still comes out as "Em yêu anh", "Em xin lỗi". Those are a woman's pronouns. The reference states the rule three times with examples, and only some sentences follow it.
- "Ủa, sao anh không rep tin nhắn em? Seen rồi mà không trả lời" returned `null` in all three runs, with no FIX or NOTE line. Something in the shared pipeline rejects it, perhaps the mix of English "Seen"/"rep" or the check on the word "anh".
- The unaccented "Khong sao dau anh" still adds "mate".
- In the long passages, cuts before "một tiếng" and "sao" (in "ra sao") give "nearby", "so what", and doubled words.

Suggested changes to the shared code:
- `server/refine.ts`: when translating into Vietnamese, add the pronoun pair explicitly next to <people>. For example: "the speaker (a man) calls himself 'anh' and the listener 'em'", or the reverse for a woman. A post-check could also flag "em yêu anh" / "em xin lỗi" when the speaker is a man talking to a woman. A small model does not apply the general gender rule reliably here.
- Look into why `refine` returns null for the "Ủa ... Seen rồi" sentence.
- `server/pipeline.ts` JOINING: add Vietnamese words that join forward: và, với, của, cho, vì, nên, mà, thì, là, gần, khi, nếu, ở, để.
