# German (de): langeval notes

Runs: 5. Reference grew from 8 lines to about 27 KB (8 groups, 160 terms). It covers Austrian, Swiss and Bavarian forms, modal particles, halb acht, separable verbs and the du/Sie difference.

What was wrong at first (before → after):
- "Hab dich lieb, mein Spatz" → "Love you, my sparrow" → "Love you, sweetie". The pet-name rule had to sit in the "how it is really spoken" group, with explicit NOT examples. It was ignored while it was only in the affection group.
- "So ein Scheiß, die Bahn hat Verspätung" → "Ugh, the train's late" → "Bloody hell, the train's late again". The strength note now says to keep the swear.
- "Na, alles klar bei dir?" → once came out as "Not bad, how are you?" → "Hey, all good with you?"
- FROM_EN "did you get up to much?" → "Hast du so was gemacht?" (broken) → "Hast du was Schönes gemacht?". "give Grandma a hug" → "drück Oma von mir".
- "Max, du bist echt ein Ehrenmann" once came out as "Mate, you're a legend": the name became "mate". A rule to keep names was added, and the name stayed in runs 4 and 5.

Still imperfect:
- "gestern" sometimes comes out as "last night".
- "sauer" comes out as "pissed off", which is a bit too strong.
- "gäll" comes out as "right?", which is fine but loose.
- Austrian "Servus Oida" becomes "G'day mate". That is acceptable, but the shared English reference makes things very Australian.

Shared code suggestions (not made):
- `server/pipeline.ts` JOINING has no German words. Phrases end on "weil", "dass", "und", "aber", "die", "hat" and "ich so". Add de joining words (und, oder, aber, weil, dass, ob, wenn, als, der, die, das, den, dem, ein, eine, zu, mit, von, bei, für, auf, in, an). Also do not end a phrase on a finite auxiliary (hat, hab, ist, bin, wird). For example, "die hat | wieder so viel gekocht" gives "she has again cooked" or "she's once again cooked".
- In WHOLE lines, a phrase that starts mid-sentence is sometimes capitalised ("I'll make it up to you Promise"). `dropRepeat` or the phrase prompt could lower-case the first letter when the shown text does not end with . ! or ?.
