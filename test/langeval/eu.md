# Basque (eu): langeval notes

4 runs. `server/slang/eu.ts` was an empty stub; it now has 8 groups (about 22 KB) and 200 `terms`. It covers euskañol mixing, hika, ergative auxiliaries (dit/diot/nau), Bizkaian clipped forms, base-20 numbers and clock times. The 28 `leftIn` words leave out ones that are also English or Spanish words ("motel", "bale", "tira", "ostia").

What was wrong at first (before -> after):
- Long stretch, phrase mode: "...flipatuta geratu nintzen ez | baitzion inori ezer esan..." -> "I was blown away, didn't I and I didn't tell anyone". Then "kafesne bat | hartu genuen" -> "took the bus", and the last two phrases came back empty, so the bus and taxi were lost. After: "I was blown away because they hadn't told anyone, then we sat down and had a white coffee ... the bus left, so I got a taxi". Part of the cause was the reference itself: listing "a bus" as an example for "hartu" primed the model.
- "beste leku | batera joan ginen" -> "we went together" (and lost "laughed until two") -> "we went somewhere else together, and we laughed until two in the morning".
- "koinatak pintxo batzuk ekarri dizkigu" -> "Your brother-in-law brought us..." -> "Sister-in-law brought us some pintxos".
- From English: "I'm absolutely knackered" -> "Nagi nago" (= I'm lazy) -> "Oso nekatuta nago"; "left me on read" -> "utzi dit" -> "irakurrita utzi nau"; "if you're keen" -> "interesa baduzu" -> "gogoa baduzu"; "massive arvo" -> "lan-arratsalde handia" -> "egun gogorra".

Still imperfect:
- Phrase mode is the weak spot. A phrase that starts with the end of a verb ("geratu nintzen", "nuen", "genuen") still sometimes comes back empty or as filler ("we had it"). The meaning is now recovered in the next phrase, but how the phrases join varies from run to run.
- "eta Mia?" -> "And Mia?" (should be "What about Mia?"); "eztakit zer esan dion" sometimes -> "what to tell them".

Shared code suggestions (not made):
- `JOINING` in `server/pipeline.ts` has no Basque words. A phrase shouldn't end on "ez" (the negation goes with the auxiliary after it), "eta", "edo", "baina", "beste" or "oso". Better still, for Basque don't cut right before an auxiliary or a bare auxiliary word (nintzen, zen, nuen, genuen, zitzaidan, dut, du, da, naiz, dugu, zuen): move the cut back so the participle and its auxiliary stay together.
- `GENDER_CUE` (`server/refine.ts`): add ama, amona, amama, aita, aitona, ahizpa, arreba, neba, anaia, izeba, osaba, koinata, koinatua, mutil-laguna, neska-laguna, senarra, emaztea, andrea, neska, mutila. Right now "ama ... egingo duela" -> "she's making" is sometimes turned into "they".
