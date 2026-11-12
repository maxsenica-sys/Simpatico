import type { Phrase } from "./phrasebook";

/**
 * Starter phrasebook: set phrases and idioms that go wrong word for word, with what people
 * really say in the other language. The daily job (server/phrasebook.ts) adds more every day,
 * for every language; this is just the seed. In `match`, every item must be said; "a|b" means
 * either wording.
 */
const en = (phrase: string, match: string[], meaning: string, tr: string): Phrase => ({ lang: "en", phrase, match, meaning, eq: { tr }, source: "seed" });
const tr = (phrase: string, match: string[], meaning: string, en: string): Phrase => ({ lang: "tr", phrase, match, meaning, eq: { en }, source: "seed" });

export const SEED: Phrase[] = [
  en("tick all the boxes", ["tick", "box"], "meets every requirement, exactly what's wanted", "tam aradığım gibi, her şeyi karşılıyor"),
  en("you'll pull through", ["pull through"], "you'll get through this hard time", "atlatacaksın, merak etme"),
  en("hang in there", ["hang in there"], "keep going, don't give up", "dayan, az kaldı"),
  en("fingers crossed", ["fingers crossed"], "hoping for good luck", "inşallah, şans dile"),
  en("touch wood", ["touch wood"], "said to avoid bad luck after saying something good", "tahtaya vur, nazar değmesin"),
  en("break a leg", ["break a leg"], "good luck (before a performance)", "bol şans"),
  en("it's not rocket science", ["rocket science"], "it's not that hard", "o kadar da zor değil"),
  en("the ball's in your court", ["ball", "court"], "it's your decision now", "top sende"),
  en("spill the tea", ["spill the tea"], "tell me the gossip", "anlat bakalım, ne dedikodu var"),
  en("spill the beans", ["spill the beans"], "reveal the secret", "ağzındaki baklayı çıkar"),
  en("on the same page", ["same page"], "we agree, understand each other", "aynı şeyi düşünüyoruz"),
  en("piece of cake", ["piece of cake"], "very easy", "çocuk oyuncağı"),
  en("under the weather", ["under the weather"], "a bit unwell", "biraz keyifsizim, rahatsızım"),
  en("call it a day", ["call it a day"], "stop for today", "bugünlük bu kadar"),
  en("it is what it is", ["it is what it is|its what it is"], "it can't be changed, accept it", "ne yapalım, olan oldu"),
  en("no worries", ["no worries"], "no problem, you're welcome, it's fine", "dert etme, sorun değil"),
  en("she'll be right", ["shell be right|she will be right"], "it'll be fine (Australian)", "her şey yoluna girer"),
  en("fair dinkum", ["fair dinkum"], "honestly, genuine, really? (Australian)", "cidden, gerçekten"),
  en("flat out", ["flat out"], "extremely busy, or at full speed (Australian)", "çok yoğunum, başımı kaşıyacak vaktim yok"),
  en("chuck a sickie", ["chuck", "sickie"], "take a day off pretending to be sick (Australian)", "hasta numarası yapıp işe gitmemek"),
  en("how ya going", ["how ya going|how are you going|how you going"], "how are you? (Australian greeting)", "nasılsın, naber"),
  en("good on ya", ["good on ya|good on you"], "well done, good for you", "aferin sana, helal olsun"),
  en("too easy", ["too easy"], "no problem, done (Australian)", "tamamdır, sorun değil"),
  en("a long shot", ["long shot"], "unlikely to work, but worth a try", "zayıf bir ihtimal"),
  en("the last straw", ["last straw"], "the final annoyance that is too much", "bardağı taşıran son damla"),
  en("kill two birds with one stone", ["two birds"], "do two things at once", "bir taşla iki kuş vurmak"),
  en("out of the blue", ["out of the blue"], "suddenly, unexpectedly", "durup dururken, birdenbire"),
  en("cost an arm and a leg", ["arm and a leg"], "very expensive", "servet değerinde, dudak uçuklatan fiyat"),
  en("once in a blue moon", ["blue moon"], "very rarely", "kırk yılda bir"),
  en("speak of the devil", ["speak of the devil"], "the person we were talking about just appeared", "iti an çomağı hazırla"),
  en("when pigs fly", ["pigs fly|pigs might fly"], "never going to happen", "balık kavağa çıkınca"),
  en("I'm all ears", ["all ears"], "I'm listening, go on", "dinliyorum, anlat"),
  en("keep me posted", ["keep me posted"], "keep me updated", "beni haberdar et"),
  en("play it by ear", ["play it by ear"], "decide as we go", "duruma göre bakarız"),
  en("my bad", ["my bad"], "my mistake, sorry", "benim hatam, kusura bakma"),
  en("take it easy", ["take it easy"], "relax; also a goodbye", "kendini yorma; kendine iyi bak"),
  en("miss you heaps", ["miss you heaps"], "miss you a lot (Australian)", "seni çok özledim"),
  en("over the moon", ["over the moon"], "extremely happy", "havalara uçtum, çok mutluyum"),
  en("sleep on it", ["sleep on it"], "think about it overnight before deciding", "bir gece düşüneyim"),
  en("you're a legend", ["youre a legend|you legend"], "you're great, thanks so much (Australian)", "sen bir efsanesin, çok sağ ol"),
  tr("gözün aydın", ["gözün aydın"], "congratulations (on good news, someone arriving)", "great news, congratulations"),
  tr("kafa dağıtmak", ["kafa dağıt"], "to take your mind off things, unwind", "take my mind off things"),
  tr("içim rahatladı", ["içim rahatla"], "I'm relieved", "what a relief"),
  tr("aklım sende", ["aklım sende"], "I keep thinking about you", "you're on my mind"),
  tr("gözümde tüttü", ["gözümde tüt"], "I missed it so much", "I've been dying for it"),
  tr("hayırlısı", ["hayırlısı"], "let's hope for the best", "fingers crossed"),
  tr("ellerine sağlık", ["ellerine sağlık"], "thanks for making this, well done", "this is so good, thank you"),
  tr("Allah kavuştursun", ["allah kavuştur"], "may you be together again soon", "hope you see each other soon"),
  tr("dört gözle bekliyorum", ["dört gözle"], "I can't wait, really looking forward to it", "I can't wait"),
];
