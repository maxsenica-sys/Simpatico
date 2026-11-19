import { baseLang, sameLanguage } from "../shared/lang";
import type { CaptionStage, CaptionState, SpeakerProfile } from "../shared/protocol";
import { log } from "./log";
import { phraseTranslate, refine, refineConfigured, type ContextLine, type People } from "./refine";
import { SonioxStream, sonioxConfigured, type SonioxToken } from "./soniox";
import { sonioxContext } from "./vocab";
import { dropRepeat, isTrivialEdit } from "./text";

/**
 * Hard deadline for pass 2, measured from the moment the utterance is finalised.
 * The brief started at 1500 ms; real calls showed Claude Haiku at 0.75–1.5 s, so 1500 dropped
 * ~40% of rewrites. 2000 keeps nearly all of them while still landing before the reader moves on.
 */
export const REFINE_DEADLINE_MS = 2000;
/** Translation tokens trail the source tokens; stop attributing them to a closed utterance after this. */
const SEAL_QUIET_MS = 700;
const SEAL_MAX_MS = 2500;
/**
 * Close the upstream socket after this long without speech; Soniox bills for as long as it is open.
 * Phones only send audio while someone is talking (plus the second before), so while the other
 * person has the floor this one's stream is just costing money. 6 s keeps it open through a short
 * reply; reopening costs ~0.3 s at the start of the next utterance, and no audio is lost (it is
 * buffered while the socket connects).
 */
const tuned = (key: string, fallback: number) => {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
const IDLE_CLOSE_MS = tuned("IDLE_CLOSE_MS", 6_000);
/**
 * Steady captions (the default reading style): a long utterance is subtitled phrase by phrase from
 * Soniox's finalised words, each phrase translated once and appended, never rewritten. A phrase is
 * ready at a clause boundary with enough words, at a length cap, or when the speaker pauses briefly.
 */
const STEADY_MIN_WORDS = tuned("STEADY_MIN_WORDS", 4);
const STEADY_MAX_WORDS = tuned("STEADY_MAX_WORDS", 8);
const STEADY_PAUSE_MS = tuned("STEADY_PAUSE_MS", 700);
const STEADY_TIMEOUT_MS = 3000;
/** Type to talk: nobody is waiting on speech, so a typed message can take a little longer. */
const TYPED_TIMEOUT_MS = 5000;
/** Live readers' faint preview of the words not yet in a phrase. */
const PREVIEW_MIN_WORDS = tuned("PREVIEW_MIN_WORDS", 2);
/** A new preview only once a couple more words have been heard (each one is a paid request). */
const PREVIEW_STEP_WORDS = tuned("PREVIEW_STEP_WORDS", 2);
const PREVIEW_EVERY_MS = tuned("PREVIEW_EVERY_MS", 500);
const PREVIEW_PARALLEL = tuned("PREVIEW_PARALLEL", 2);
const PREVIEW_SEND_MS = 90;
const PREVIEW_TIMEOUT_MS = 2500;
const VERB_FINAL = new Set(["tr", "hi", "ur", "bn", "ja", "ko", "fa", "ta", "te", "mr", "kn", "ml", "gu", "pa", "az", "kk", "uz", "mn", "my", "ne", "si"]);
/** Short joining words a phrase shouldn't end on (the main Latin-script app languages). */
const JOINING = /^(and|or|but|so|when|if|that|which|who|where|while|because|the|a|an|of|to|in|on|at|for|with|from|by|as|than|then|ve|ama|ile|için|gibi|de|da|ki|и|а|но|что|когда|в|на|с|y|o|pero|que|cuando|el|la|los|las|de|en|con|para|e|ou|mas|quando|o|os|as|do|da|em|com|et|ou|mais|quand|le|les|du|des|dans|avec|pour|dan|atau|tapi|yang|di|ke|dari|untuk)$/i;
/**
 * Turkish and Azerbaijani "de/da" (too) and "ki" attach to the word BEFORE them, so a phrase may
 * end on them (in Spanish or French "de" joins forward). "bi"/"bir" (a) never ends a phrase.
 */
const ENCLITIC = new Set(["tr", "az"]);
/** Turkish words that lean on the word after them: a phrase cut here reads wrongly ("ne | iş yapıyorsun", "o kadar | yoruldum"). */
const TR_LEANS = /^(bi|bir|ne|neden|niye|nasıl|hangi|kaç|çok|en|daha|pek|hiç|her|bu|şu|o|böyle|öyle|şöyle|biraz|kadar|hem|ya|veya|yoksa|çünkü|eğer|sanki|bile|sadece|yalnız|tam|artık|hala|hâlâ|yine|gene|zaten|belki|galiba|herhalde|mutlaka|kesin)$/i;
/**
 * Per language: articles, prepositions, conjunctions and pronouns that go with the word after them
 * (Slavic "se/się/v/na", German "weil/die", French "je/c'est"). A phrase cut after one of these
 * reads wrongly and makes the translator repeat or lose words where the phrases join.
 */
const JOIN_BY_LANG: Record<string, string> = {
  de: "und|oder|aber|weil|dass|wenn|als|ob|denn|sondern|der|die|das|den|dem|des|ein|eine|einen|einem|einer|mit|von|zu|zum|zur|in|im|an|am|auf|für|bei|nach|aus|über|unter|vor|ich|du|er|sie|es|wir|ihr|mein|meine|dein|deine|sein|seine|hat|habe|hab|ist|bin|war|wird|will|kann|muss|soll|nicht|so|auch|noch|schon|dann|da",
  nl: "en|of|maar|omdat|dat|als|want|toen|de|het|een|met|van|naar|in|op|aan|voor|bij|uit|over|ik|je|jij|hij|ze|zij|we|wij|mijn|jouw|zijn|haar|heb|heeft|is|ben|was|wil|kan|moet|ga|gaat|niet|nog|al|dan|zo|er",
  af: "en|of|maar|omdat|want|dat|as|toe|die|'n|met|van|na|in|op|aan|vir|by|uit|oor|ek|jy|hy|sy|ons|julle|hulle|my|jou|het|is|was|wil|kan|moet|gaan|nie|nog|al|dan|so|daar",
  fr: "et|ou|mais|parce|que|qu'|quand|si|comme|le|la|les|l'|un|une|des|du|de|d'|à|au|aux|en|dans|sur|pour|avec|chez|par|sans|je|j'|tu|il|elle|on|nous|vous|ils|elles|ce|c'est|c'|ça|mon|ma|mes|ton|ta|tes|son|sa|ses|ne|n'|me|m'|te|t'|se|s'|lui|leur|y|est|suis|ai|as|a|va|vais|fait|pas|plus|très|trop|alors",
  cy: "a|ac|ond|neu|achos|bod|pan|os|y|yr|'r|i|o|ar|at|am|gyda|efo|yn|mewn|dros|wrth|fy|dy|ei|ein|eich|eu|mae|roedd|dw|dwi|wnes|wedi|ddim|mor|rhy",
  es: "y|e|o|u|pero|porque|que|cuando|si|como|el|la|los|las|lo|un|una|unos|unas|al|del|de|a|en|con|por|para|sin|sobre|entre|hasta|desde|mi|mis|tu|tus|su|sus|me|te|se|nos|le|les|no|muy|más|ya|es|está|estoy|he|ha|has|voy|va",
  ca: "i|o|però|perquè|que|quan|si|com|el|la|els|les|l'|un|una|uns|unes|al|del|de|d'|a|en|amb|per|sense|sobre|fins|meu|meva|teu|teva|seu|seva|em|et|es|ens|us|li|no|molt|més|ja|és|està|estic|he|ha|vaig|va",
  gl: "e|ou|pero|porque|que|cando|se|como|o|a|os|as|un|unha|uns|unhas|ao|á|do|da|dos|das|de|en|no|na|nos|nas|con|por|para|sen|sobre|ata|desde|meu|miña|teu|túa|seu|súa|me|te|lle|non|moi|máis|xa|é|está|estou|vou|vai",
  pt: "e|ou|mas|porque|que|quando|se|como|o|a|os|as|um|uma|uns|umas|ao|à|do|da|dos|das|de|em|no|na|nos|nas|num|numa|com|por|pelo|pela|para|pra|sem|sobre|até|meu|minha|teu|tua|seu|sua|me|te|lhe|não|muito|mais|já|é|tá|está|estou|vou|vai|tô",
  it: "e|o|ma|perché|che|quando|se|come|il|lo|la|i|gli|le|l'|un|uno|una|un'|al|allo|alla|ai|agli|alle|del|dello|della|dei|degli|delle|di|a|da|in|nel|nella|con|su|sul|sulla|per|tra|fra|mio|mia|tuo|tua|suo|sua|mi|ti|si|ci|vi|gli|ne|non|molto|più|già|è|sono|ho|ha|sto|vado|va",
  ro: "și|sau|dar|pentru|că|când|dacă|ca|cum|un|o|niște|al|a|ale|ai|de|la|în|pe|cu|din|despre|fără|până|meu|mea|tău|ta|său|sa|mă|te|se|îl|o|ne|vă|le|nu|foarte|mai|deja|e|este|sunt|am|ai|are|vreau|merg",
  pl: "i|a|ale|albo|lub|bo|że|żeby|kiedy|jak|gdy|jeśli|czy|w|we|na|z|ze|do|od|o|po|przy|dla|bez|pod|nad|przez|za|u|się|mi|ci|go|mu|jej|ją|nie|tak|to|ten|ta|jest|jestem|był|była|mój|moja|twój|twoja|jego|bardzo|już|jeszcze|też",
  cs: "a|i|ale|nebo|protože|že|když|jak|jestli|v|ve|na|s|se|z|ze|do|od|o|po|při|pro|bez|pod|nad|přes|za|u|k|ke|si|mi|ti|mu|jí|ji|ho|ne|tak|to|ten|ta|je|jsem|byl|byla|můj|moje|tvůj|tvoje|jeho|její|moc|už|ještě|taky|fakt",
  sk: "a|i|ale|alebo|lebo|pretože|že|keď|ako|či|v|vo|na|s|so|z|zo|do|od|o|po|pri|pre|bez|pod|nad|cez|za|u|k|ku|sa|si|mi|ti|mu|jej|ju|ho|nie|tak|to|ten|tá|je|som|bol|bola|môj|moja|tvoj|tvoja|jeho|veľmi|už|ešte|aj",
  sl: "in|pa|ali|ampak|ker|da|ko|kot|če|v|na|z|s|iz|do|od|o|po|pri|za|brez|pod|nad|čez|k|h|se|si|mi|ti|mu|ji|ga|jo|ne|tako|to|ta|je|sem|sta|smo|bil|bila|moj|moja|tvoj|tvoja|njegov|zelo|že|še|tudi",
  hr: "i|a|ali|ili|jer|da|kad|kada|kao|ako|u|na|s|sa|iz|do|od|o|po|pri|za|bez|pod|nad|kroz|k|ka|se|si|mi|ti|mu|joj|ga|je|ju|ne|nije|tako|to|taj|ta|sam|smo|bio|bila|moj|moja|tvoj|tvoja|njegov|jako|već|još|baš",
  bs: "i|a|ali|ili|jer|da|kad|kada|kao|ako|u|na|s|sa|iz|do|od|o|po|pri|za|bez|pod|nad|kroz|k|ka|se|si|mi|ti|mu|joj|ga|je|ju|ne|nije|tako|to|taj|ta|sam|smo|bio|bila|moj|moja|tvoj|tvoja|njegov|jako|već|još|baš",
  sr: "и|а|али|или|јер|да|кад|када|као|ако|у|на|с|са|из|до|од|о|по|при|за|без|под|над|кроз|к|ка|се|си|ми|ти|му|јој|га|је|ју|не|није|тако|то|тај|та|сам|смо|био|била|мој|моја|твој|твоја|баш|већ|још|i|a|ali|ili|jer|da|kad|kada|kao|ako|u|na|s|sa|iz|do|od|o|po|za|bez|se|si|mi|ti|mu|ga|je|ne|nije|to|sam|bio|bila|moj|moja|baš",
  ru: "и|а|но|или|что|чтобы|когда|если|как|потому|в|во|на|с|со|к|ко|у|о|об|от|до|из|за|по|под|над|для|без|про|через|при|я|ты|он|она|мы|вы|они|мой|моя|мои|твой|твоя|его|её|ее|их|наш|не|ни|так|очень|уже|ещё|еще|бы|же|это|этот|эта|был|была|будет|меня|тебя|мне|тебе",
  uk: "і|й|та|а|але|або|що|щоб|коли|якщо|як|бо|в|у|на|з|із|зі|до|від|о|об|по|за|під|над|для|без|про|через|при|я|ти|він|вона|ми|ви|вони|мій|моя|мої|твій|твоя|його|її|їх|наш|не|ні|так|дуже|вже|ще|б|би|ж|же|це|цей|ця|був|була|буде|мене|тебе|мені|тобі",
  be: "і|й|ды|а|але|ці|што|каб|калі|як|бо|у|ў|на|з|са|да|ад|аб|па|за|пад|над|для|без|пра|праз|пры|я|ты|ён|яна|мы|вы|яны|мой|мая|мае|твой|твая|яго|яе|іх|наш|не|ні|так|вельмі|ужо|яшчэ|б|бы|ж|жа|гэта|гэты|быў|была|будзе|мяне|цябе|мне|табе",
  bg: "ама|ами|и|а|но|или|че|за|да|когато|ако|като|защото|в|във|на|с|със|от|до|по|при|без|под|над|през|към|у|аз|ти|той|тя|ние|вие|те|моят|моя|моята|твоят|твоята|му|ѝ|им|се|си|ме|те|го|я|ги|не|ни|много|вече|още|ще|бе|е|съм|беше|този|тази|това",
  mk: "ама|и|а|но|или|дека|да|кога|ако|како|затоа|во|на|со|од|до|по|при|без|под|над|преку|кон|кај|за|јас|ти|тој|таа|ние|вие|тие|мој|моја|мое|твој|твоја|му|ѝ|им|се|си|ме|те|го|ја|ги|не|ни|многу|веќе|уште|ќе|е|сум|беше|овој|оваа|ова",
  el: "και|κι|ή|αλλά|γιατί|επειδή|ότι|πως|που|όταν|αν|σαν|ο|η|το|οι|τα|τον|την|του|της|των|τους|τις|ένα|μια|μία|έναν|σε|στο|στη|στην|στον|στα|στους|στις|με|από|για|χωρίς|μέχρι|ως|μου|σου|του|μας|σας|θα|να|δεν|μην|μη|πολύ|πιο|ήδη|ακόμα|είναι|είμαι|ήταν|έχω|έχει",
  lt: "ir|o|bet|ar|arba|nes|kad|kai|jei|jeigu|kaip|į|iš|su|be|ant|po|prie|už|per|nuo|iki|apie|pas|aš|tu|jis|ji|mes|jūs|jie|jos|mano|tavo|jo|jos|savo|ne|nėra|labai|jau|dar|taip|yra|buvo|bus|tas|ta|tai",
  lv: "un|vai|bet|jo|ka|kad|ja|kā|lai|ar|no|uz|pie|par|pēc|bez|līdz|pa|caur|aiz|es|tu|viņš|viņa|mēs|jūs|viņi|manu|mans|mana|tavs|tava|viņa|savs|ne|nav|ļoti|jau|vēl|tā|ir|bija|būs|tas|tā",
  hu: "és|meg|de|vagy|mert|hogy|amikor|ha|mint|ahogy|a|az|egy|nem|is|már|még|nagyon|túl|ez|az|minden|sok|kicsit|olyan|annyira|csak|mindig|soha|el|ki|be|fel|le|meg|össze",
  fi: "ja|tai|mutta|koska|että|kun|jos|kuin|ettei|se|ne|tämä|tuo|minä|mä|sinä|sä|hän|me|te|he|mun|sun|mitä|ei|en|et|oli|on|ole|tosi|niin|jo|vielä|liian|aika|ihan|hyvin",
  et: "ja|ning|või|aga|sest|et|kui|nagu|kuna|see|need|too|mina|ma|sina|sa|tema|ta|meie|me|teie|te|nemad|nad|minu|mu|sinu|su|ei|pole|oli|on|väga|juba|veel|liiga|nii|üsna",
  da: "og|eller|men|fordi|at|når|hvis|som|da|en|et|den|det|de|med|fra|til|i|på|af|for|om|hos|under|over|efter|jeg|du|han|hun|vi|I|min|mit|mine|din|dit|dine|hans|hendes|sin|sit|ikke|har|er|var|vil|kan|skal|så|meget|også|lige",
  no: "og|eller|men|fordi|at|når|hvis|som|da|en|ei|et|den|det|de|med|fra|til|i|på|av|for|om|hos|under|over|etter|jeg|du|han|hun|vi|dere|min|mitt|mine|din|ditt|dine|hans|hennes|sin|sitt|ikke|har|er|var|vil|kan|skal|så|veldig|også|bare",
  sv: "och|eller|men|för|att|när|om|som|då|en|ett|den|det|de|med|från|till|i|på|av|hos|under|över|efter|jag|du|han|hon|vi|ni|min|mitt|mina|din|ditt|dina|hans|hennes|sin|sitt|inte|har|är|var|vill|kan|ska|så|väldigt|också|bara",
  sq: "dhe|e|ose|apo|por|sepse|se|që|kur|nëse|si|në|me|nga|për|pa|mbi|nën|te|tek|deri|unë|ti|ai|ajo|ne|ju|ata|ato|im|ime|yt|jote|i|tij|saj|nuk|s'|mos|shumë|më|tashmë|ende|është|jam|ishte|kam|ka|do|të",
  eu: "eta|edo|baina|ze|zer|nire|zure|bere|gure|ez|oso|ere|hau|hori|hura|ni|zu|hura|gu|zuek|haiek",
  id: "dan|atau|tapi|tetapi|karena|kalau|kalo|jika|ketika|waktu|pas|yang|di|ke|dari|untuk|buat|sama|dengan|dalam|pada|oleh|tentang|aku|saya|kamu|lu|lo|dia|kami|kita|mereka|udah|sudah|belum|lagi|mau|akan|bakal|nggak|gak|tidak|enggak|bukan|sangat|banget|terus|jadi|biar|supaya|si|para|ini|itu",
  ms: "macam|camne|dan|atau|tapi|tetapi|sebab|kerana|kalau|jika|bila|ketika|yang|di|ke|dari|daripada|untuk|dengan|dalam|pada|oleh|tentang|aku|saya|kau|awak|engkau|dia|kami|kita|mereka|dah|sudah|belum|lagi|nak|akan|tak|tidak|bukan|sangat|sungguh|terus|jadi|supaya|si|para|ini|itu",
  tl: "at|o|pero|kasi|dahil|na|nang|kung|kapag|pag|habang|ang|ng|sa|mga|si|sina|ni|nina|kay|kina|ako|ka|ikaw|siya|kami|tayo|kayo|sila|ko|mo|niya|namin|natin|ninyo|nila|hindi|di|wag|huwag|ay|ba|pa|na|lang|din|rin|daw|raw|naman|talaga|sobrang|ang",
  vi: "và|hoặc|nhưng|vì|tại|nên|rằng|là|khi|nếu|thì|mà|của|ở|tại|với|cho|từ|đến|trong|trên|dưới|về|tôi|tao|mình|em|anh|chị|bạn|mày|nó|họ|chúng|các|những|một|cái|con|không|chưa|đã|đang|sẽ|rất|lắm|quá|cũng|vẫn|còn|được|bị|hãy|đừng",
  sw: "na|au|lakini|kwa|kwamba|kuwa|kama|wakati|ili|ya|wa|za|cha|vya|la|kwenye|katika|kutoka|mpaka|hadi|bila|mimi|wewe|yeye|sisi|ninyi|wao|si|sio|hapana|sana|tu|pia|bado|tayari|huyu|hii|hiyo|hilo|yule",
  az: "və|amma|ancaq|yoxsa|çünki|əgər|bu|o|bir|çox|ən|daha|heç|hər|necə|nə|niyə|hansı|belə|elə|artıq|hələ|yenə|sadəcə|bəlkə|lap",
  kk: "және|мен|бен|пен|бірақ|немесе|себебі|егер|бұл|сол|ол|бір|өте|ең|тағы|әлі|енді|қандай|қалай|неге|не|кім|барлық|әр|тек|мүмкін|дәл|сондай|мынадай",
  he: "ו|או|אבל|כי|ש|כש|אם|כמו|ה|ב|ל|מ|את|של|עם|על|אל|מן|בלי|עד|אני|אתה|את|הוא|היא|אנחנו|אתם|הם|הן|לא|אין|מאוד|כבר|עוד|גם|זה|זאת|הזה|הזאת|היה|הייתה|יהיה",
  ar: "و|أو|او|لكن|بس|لأن|لان|عشان|علشان|إن|ان|أن|لما|لو|إذا|اذا|زي|مثل|في|على|من|إلى|الى|عن|مع|ل|ب|ال|انا|أنا|انت|أنت|انتي|هو|هي|احنا|نحن|انتو|هم|ما|مش|مو|لا|لم|لن|كتير|كثير|جدا|خلاص|بعد|لسا|لسه|كمان|هذا|هذه|هاد|هاي|ده|دي|كان|كانت|رح|راح|حـ|ح|بدي|عايز",
  fa: "و|یا|ولی|اما|چون|چونکه|که|وقتی|اگه|اگر|مثل|در|تو|به|از|با|برای|بی|تا|روی|زیر|من|تو|او|اون|ما|شما|اونا|آنها|نه|نمی|خیلی|دیگه|هنوز|هم|این|اون|آن|یه|یک|بود|هست|می",
  hi: "और|या|लेकिन|पर|पर|क्योंकि|कि|जब|अगर|जैसे|तो|का|की|के|को|में|से|पे|तक|साथ|लिए|बिना|मैं|तुम|तू|आप|वो|वह|हम|वे|मेरा|मेरी|मेरे|तेरा|तेरी|तुम्हारा|उसका|उसकी|नहीं|मत|न|बहुत|बड़ा|भी|ही|अभी|फिर|यह|ये|वो|एक|था|थी|aur|ya|lekin|par|kyunki|ki|jab|agar|jaise|to|ka|ke|ko|mein|se|tak|main|tum|aap|woh|hum|mera|meri|tera|nahi|bahut|bhi|hi|abhi|phir|yeh|ek",
  ur: "اور|یا|لیکن|مگر|کیونکہ|کہ|جب|اگر|جیسے|تو|کا|کی|کے|کو|میں|سے|پر|تک|ساتھ|لیے|لئے|بغیر|میں|تم|تو|آپ|وہ|ہم|میرا|میری|میرے|تیرا|تمہارا|اس|نہیں|مت|نہ|بہت|بھی|ہی|ابھی|پھر|یہ|ایک|تھا|تھی",
  mr: "आणि|किंवा|पण|परंतु|कारण|की|जेव्हा|जर|तर|सारखे|मी|तू|तुम्ही|आपण|तो|ती|ते|आम्ही|माझा|माझी|माझे|तुझा|तुझी|त्याचा|तिचा|नाही|नको|खूप|फार|पण|ही|च|आता|मग|हा|हे|एक|होता|होती",
  pa: "ਅਤੇ|ਤੇ|ਜਾਂ|ਪਰ|ਕਿਉਂਕਿ|ਕਿ|ਜਦੋਂ|ਜੇ|ਜੇਕਰ|ਵਾਂਗ|ਦਾ|ਦੀ|ਦੇ|ਨੂੰ|ਵਿੱਚ|ਵਿਚ|ਤੋਂ|ਨਾਲ|ਲਈ|ਤੱਕ|ਮੈਂ|ਤੂੰ|ਤੁਸੀਂ|ਉਹ|ਅਸੀਂ|ਮੇਰਾ|ਮੇਰੀ|ਤੇਰਾ|ਨਹੀਂ|ਨਾ|ਬਹੁਤ|ਵੀ|ਹੀ|ਹੁਣ|ਫਿਰ|ਇਹ|ਇੱਕ|ਸੀ",
  gu: "અને|કે|અથવા|પણ|પરંતુ|કારણ|જ્યારે|જો|તો|જેમ|નો|ની|નું|ના|ને|માં|થી|પર|સાથે|માટે|સુધી|હું|તું|તમે|તે|અમે|આપણે|મારો|મારી|મારું|તારો|તારી|નથી|ના|બહુ|ખૂબ|પણ|જ|હવે|પછી|આ|એક|હતો|હતી",
  bn: "আর|এবং|ও|কিংবা|বা|কিন্তু|তবে|কারণ|যে|যখন|যদি|তাহলে|মতো|আমি|তুমি|তুই|আপনি|সে|ও|আমরা|তোমরা|ওরা|তারা|আমার|তোমার|তোর|ওর|তার|না|নেই|খুব|অনেক|ও|ই|এখন|তারপর|এই|এটা|ওই|একটা|এক",
  ta: "மற்றும்|அல்லது|ஆனால்|ஆனா|ஏனென்றால்|ஏன்னா|என்று|என்னு|எப்போது|அப்போ|என்றால்|ஆனா|நான்|நீ|நீங்க|நீங்கள்|அவன்|அவள்|அவர்|அவங்க|நாம|நாங்க|நாங்கள்|என்|என்னோட|உன்|உன்னோட|இல்ல|இல்லை|ரொம்ப|மிக|கூட|தான்|இப்போ|இப்ப|அப்புறம்|இந்த|அந்த|ஒரு",
  te: "మరియు|లేదా|కానీ|కాని|ఎందుకంటే|అని|ఎప్పుడు|అయితే|ఐతే|లాగా|నేను|నువ్వు|మీరు|అతను|ఆమె|వాడు|ఆవిడ|మేము|మనం|వాళ్ళు|నా|నీ|మీ|అతని|ఆమె|కాదు|లేదు|వద్దు|చాలా|బాగా|కూడా|ఇప్పుడు|తర్వాత|ఈ|ఆ|ఒక",
  kn: "ಮತ್ತು|ಅಥವಾ|ಆದರೆ|ಆದ್ರೆ|ಯಾಕಂದ್ರೆ|ಏಕೆಂದರೆ|ಅಂತ|ಎಂದು|ಯಾವಾಗ|ಆದರೆ|ಅಂದ್ರೆ|ನಾನು|ನೀನು|ನೀವು|ಅವನು|ಅವಳು|ಅವರು|ನಾವು|ನನ್ನ|ನಿನ್ನ|ನಿಮ್ಮ|ಅವನ|ಅವಳ|ಇಲ್ಲ|ಬೇಡ|ತುಂಬಾ|ಬಹಳ|ಕೂಡ|ಸಹ|ಈಗ|ಆಮೇಲೆ|ಈ|ಆ|ಒಂದು",
  ml: "പിന്നെ|അല്ലെങ്കിൽ|പക്ഷേ|പക്ഷെ|കാരണം|എന്ന്|എപ്പോൾ|എങ്കിൽ|പോലെ|ഞാൻ|നീ|നിങ്ങൾ|അവൻ|അവൾ|അവർ|ഞങ്ങൾ|നമ്മൾ|എന്റെ|നിന്റെ|നിങ്ങളുടെ|അവന്റെ|അവളുടെ|ഇല്ല|വേണ്ട|വളരെ|നല്ല|ഉം|ഇപ്പോൾ|പിന്നെ|ഈ|ആ|ഒരു",
  th: "",
};
const JOIN_RE: Record<string, RegExp> = Object.fromEntries(
  Object.entries(JOIN_BY_LANG)
    .filter(([, w]) => w)
    .map(([lang, w]) => [lang, new RegExp(`^(${w})$`, "iu")]),
);
export function joinsForward(word: string, lang: string): boolean {
  const w = word.replace(/[^\p{L}\p{M}\p{N}'’]+/gu, "");
  if (ENCLITIC.has(lang)) return TR_LEANS.test(w) || !!JOIN_RE[lang]?.test(w) || (JOINING.test(w) && !/^(de|da|ki)$/i.test(w));
  // A number goes with what it counts ("three | hours" loses the three).
  return JOINING.test(w) || !!JOIN_RE[lang]?.test(w) || /^\d+([.,:]\d+)?$/.test(w);
}
/**
 * Chinese and Japanese have no spaces, so a phrase is cut by characters: move the cut back (a few
 * characters at most) to where a word or clause clearly ends, never inside a word ("朋|友") or a
 * verb ("行っ|た"). Returns the number of characters to take.
 */
const JA_AFTER = /[はがをにでともへねよかやし]/u; // particles: a cut right after one is clean
const KANJI = /\p{Script=Han}/u;
const KANA_TAIL = /[っッゃゅょャュョーぁぃぅぇぉ]/u;
const PUNCT = /[。！？，、；：…!?,.]/u;
const segmenters = new Map<string, Intl.Segmenter>();
/** Word starts (in characters) for Chinese and Thai, from the built-in dictionary segmenter. */
function wordStarts(units: string[], lang: string): Set<number> | null {
  if (lang !== "zh" && lang !== "th") return null;
  let seg = segmenters.get(lang);
  if (!seg) segmenters.set(lang, (seg = new Intl.Segmenter(lang, { granularity: "word" })));
  const starts = new Set<number>();
  let at = 0;
  for (const s of seg.segment(units.join(""))) {
    starts.add(at);
    at += Array.from(s.segment).length;
  }
  starts.add(at);
  return starts;
}
export function cleanCut(units: string[], n: number, lang: string, min: number): number {
  if (n >= units.length) return n;
  const lo = Math.max(min, n - 8);
  for (let k = n; k >= lo; k--) if (PUNCT.test(units[k - 1] ?? "")) return k;
  const starts = wordStarts(units, lang);
  if (starts) {
    // Chinese sentence particles end the clause before them: never start a phrase with one.
    for (let k = n; k >= lo; k--) if (starts.has(k) && !/[了的吗呢吧啊呀啦嘛着过]/u.test(units[k] ?? "")) return k;
    return n;
  }
  // Japanese: right after a particle, never inside a word or before a verb ending ("行っ|た").
  const ok = (k: number, particle: boolean) => {
    const prev = units[k - 1] ?? "";
    const next = units[k] ?? "";
    if (KANA_TAIL.test(next) || /[てたでだ]/u.test(next)) return false;
    if (particle) return JA_AFTER.test(prev) && !JA_AFTER.test(next);
    return !(KANJI.test(prev) && /\p{Script=Hiragana}/u.test(next));
  };
  for (let k = n; k >= lo; k--) if (ok(k, true)) return k;
  for (let k = n; k >= lo; k--) if (ok(k, false)) return k;
  return n;
}
const CLAUSE_END = /[.!?;:,…。！？，、；：؟،।]["'”’)\]]*\s*$/u;
const BACKOFF_MS = [0, 250, 1000, 2000, 5000];
/**
 * Claude writes the subtitles, so Soniox only transcribes (its own translation is billed per word).
 * If Claude keeps failing, Soniox's translation comes back on as the backup for a while.
 */
const CLAUDE_MISSES_FOR_BACKUP = 4;
const BACKUP_MS = 5 * 60_000;

/**
 * Which readers a caption is for: "instant" (word by word, may be revised), "steady" (phrase by
 * phrase, append-only), or "all" when there is only one version.
 */
export type CaptionStyleTag = "instant" | "steady" | "all";

/** What a pipeline says to the people reading this speaker; the room adds who it is from. */
export type ReaderMsg =
  | { t: "caption"; id: string; stage: CaptionStage; text: string; tail?: string; style?: CaptionStyleTag; cover?: number }
  | { t: "captions"; state: CaptionState; side: "theirs" };
export type SpeakerMsg =
  | { t: "own"; id: string; text: string; final: boolean }
  | { t: "captions"; state: CaptionState; side: "mine" };

export interface PipelineHost {
  /** Room-unique label for logs and Soniox. */
  ref: string;
  /** How this speaker is labelled in LLM context ("A", "B", …). */
  label: string;
  /** The readers of this pipeline's target language. */
  toReader(msg: ReaderMsg): void;
  toSpeaker(msg: SpeakerMsg): void;
  /**
   * Readers who read the speaker's own language (group calls): they get the original words.
   * Only set on the speaker's primary translating pipeline, so they get them once.
   */
  toOriginal?(msg: ReaderMsg): void;
  /** Last utterances of the conversation, both sides, oldest first. */
  context(): ContextLine[];
  record(line: ContextLine): void;
  glossary(): Record<string, string>;
  /** Seconds an upstream stream was open (Soniox bills by open time), reported when it closes. */
  billed?(seconds: number): void;
  /**
   * A caption line settled: what was said and how it was translated. The room keeps the latest
   * ones in memory only, so a reader can report a bad translation (see rooms.ts).
   */
  settled?(id: string, source: string, translation: string): void;
  /** First names of everyone in the call, so the translator can recognise a misheard name. */
  callNames?(): string[];
  /** Names and words the people in the call saved on their Me page (a pet, a place, a nickname). */
  callWords?(): string[];
  speakerName?(): string;
  /** Names of the people in the call, so speech recognition spells them right. */
  names?(): string[];
  /** The speaker's optional profile: where they're from, their words and usual topics. */
  profile?(): SpeakerProfile;
  /** Optional genders of the speaker and (when there is exactly one) the reader, for grammar. */
  people?(): People;
  /** Reading styles wanted by this pipeline's readers right now. Both when not given. */
  styles?(): { steady: boolean; instant: boolean };
}

type Utterance = {
  id: string;
  origFinal: string;
  origLive: string;
  trFinal: string;
  trLive: string;
  state: "open" | "closing" | "done";
  /** No more translation tokens will be attributed to it. */
  sealed: boolean;
  refineDone: boolean;
  refined: string | null;
  sealTimer?: NodeJS.Timeout;
  sealMax?: NodeJS.Timeout;
  lastReaderText?: string;
  lastOwnText?: string;
  lastOrigText?: string;
  /** Live readers: a quick translation of the words after the shown phrases (faint, may change). */
  previewText: string;
  previewSource: string;
  previewInFlight: number;
  previewAt: number;
  previewSeq: number;
  previewShownSeq: number;
  previewSentAt: number;
  previewSendTimer?: NodeJS.Timeout;
  previewTimer?: NodeJS.Timeout;
  previewCover: number;
  /** Where the tail started and how many words it had at the last preview. */
  previewFrom: number;
  previewWords: number;
  /** Steady captions: words of the utterance already translated and shown. */
  steadyWords: number;
  /** Steady captions: the subtitle shown so far for this utterance (only ever appended to). */
  steadyText: string;
  steadyBusy: boolean;
  steadyDone: boolean;
  steadyFails: number;
  steadyTimer?: NodeJS.Timeout;
};

const END_TOKENS = new Set(["<end>", "<fin>"]);
const SENTENCE_END = /[.!?。！？…؟।]["'”’)\]]*\s*$/u;

/**
 * Captions for one speaker's microphone, delivered to the other participant.
 * Pass 1 forwards Soniox tokens as they arrive; pass 2 swaps in an idiomatic LLM rewrite
 * when an utterance ends, subject to the anti-flicker rules.
 */
export class SpeakerPipeline {
  private speaks: string | null = null;
  private reads: string | null = null;
  private stream: SonioxStream | null = null;
  private failures = 0;
  private fatalUntil = 0;
  private idleTimer: NodeJS.Timeout | null = null;
  private seq = 0;
  /** Makes utterance ids unique across re-seats, so a rejoin never overwrites old transcript lines. */
  private readonly epoch = Date.now().toString(36);
  private open: Utterance | null = null;
  /** Closed utterances whose translation may still be streaming in, oldest first. */
  private closing: Utterance[] = [];
  /** The open Soniox stream also translates (only when Claude isn't writing the subtitles). */
  private sonioxTranslates = false;
  private claudeMisses = 0;
  private backupUntil = 0;
  /**
   * Group calls: one pipeline per language the speaker is read in. While Claude writes the
   * subtitles, Soniox only transcribes, so the same words serve every language: the leader opens
   * the one stream and passes the words on to its followers, who each translate them.
   */
  private leader: SpeakerPipeline | null = null;
  private followers = new Set<SpeakerPipeline>();

  constructor(private host: PipelineHost) {}

  /** Configure from the speaker's `speaks` and the reader's `reads`. Null reader means nobody to caption for. */
  setLanguages(speaks: string, reads: string | null) {
    const changed = !this.speaks || !this.reads || !reads || baseLang(speaks) !== baseLang(this.speaks) || baseLang(reads) !== baseLang(this.reads);
    this.speaks = speaks;
    this.reads = reads;
    if (changed) this.stopStream("reconfigure");
  }

  private get translating() {
    return !!this.speaks && !!this.reads && !sameLanguage(this.speaks, this.reads);
  }

  /** Claude writes the subtitles (and Soniox only transcribes). */
  private get claudeWrites() {
    return this.translating && refineConfigured() && Date.now() >= this.backupUntil;
  }

  /** Take this speaker's words from `leader` instead of opening a stream (null: open our own). */
  follow(leader: SpeakerPipeline | null) {
    if (leader === this) leader = null;
    if (this.leader === leader) return;
    this.leader?.followers.delete(this);
    this.leader = leader;
    if (!leader) return;
    leader.followers.add(this);
    // A follower doesn't lead anyone, and its own stream (if any) is no longer needed.
    for (const f of this.followers) f.leader = null;
    this.followers.clear();
    this.stopStream("follow");
  }

  /** Words come from the leader's stream (only while no Soniox translation is needed here). */
  private get sharing() {
    return !!this.leader?.reads && this.claudeWrites;
  }

  /** Pass the leader's stream on: the speaker's own words only, never its translation. */
  private forward(fn: (f: SpeakerPipeline) => void) {
    for (const f of this.followers) if (f.sharing) fn(f);
  }

  audio(chunk: Buffer) {
    if (!this.speaks || !this.reads) return; // nobody listening: never open a billable stream
    if (this.sharing) {
      if (this.stream) this.stopStream("shared");
      return; // the leader's stream carries these words
    }
    if (!sonioxConfigured()) return;
    if (Date.now() < this.fatalUntil) return;
    if (!this.stream) this.startStream();
    this.stream!.sendAudio(chunk);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.stopStream("idle"), IDLE_CLOSE_MS);
  }

  /** In person: words from a shared stream (see server/inperson.ts) instead of our own. */
  feed(tokens: SonioxToken[]) {
    this.onTokens(tokens);
  }

  /** In person: the shared stream went away; settle what we have. */
  flush() {
    this.flushOpen();
  }

  /** Client-side voice activity ended (after its hangover): finalize instead of waiting for the endpoint. */
  speechEnded() {
    if (this.open && (this.open.origFinal || this.open.origLive)) this.stream?.finalize();
  }

  /**
   * Type to talk: a typed message goes out like a finished sentence, translated with the
   * conversation as context (or as typed, for readers of the same language). `primary` is
   * the one pipeline that also records it and shows it to the speaker and same-language readers.
   */
  typed(text: string, primary: boolean) {
    if (!this.speaks || !this.reads) return;
    const id = `${this.host.ref}-${this.epoch}-t${++this.seq}`;
    const context = this.host.context();
    if (primary) {
      this.host.record({ who: this.host.label, lang: this.speaks, text });
      this.host.toSpeaker({ t: "own", id, text, final: true });
      this.host.toOriginal?.({ t: "caption", id: `${id}-src`, stage: "final", text });
    }
    if (!this.translating) {
      this.host.toReader({ t: "caption", id, stage: "final", text, style: "all" });
      return;
    }
    refine({
      source: text,
      sourceLang: this.speaks,
      targetLang: this.reads,
      speaker: this.host.label,
      context,
      glossary: this.host.glossary(),
      people: this.host.people?.(),
      profile: this.host.profile?.(),
      callNames: this.host.callNames?.(),
      callWords: this.host.callWords?.(),
      speakerName: this.host.speakerName?.(),
      signal: AbortSignal.timeout(TYPED_TIMEOUT_MS),
    }).then((out) => {
      // If translation fails, the reader still gets the message as typed rather than nothing.
      const shown = out ?? text;
      this.host.toReader({ t: "caption", id, stage: "final", text: shown, style: "all" });
      if (out) this.host.settled?.(id, text, out);
    });
  }

  /** Participant gone, or reader gone. Closes upstream immediately. */
  stop() {
    this.stopStream("stop");
    this.follow(null);
    for (const f of this.followers) f.leader = null;
    this.followers.clear();
    this.speaks = this.reads = null;
  }

  private startStream() {
    const source = baseLang(this.speaks)!;
    // Soniox's own translation is only needed when Claude isn't writing the subtitles.
    const target = this.translating && !this.claudeWrites ? baseLang(this.reads)! : null;
    this.sonioxTranslates = !!target;
    const stream = new SonioxStream({ source, target, ref: this.host.ref, context: sonioxContext(source, this.host.names?.() ?? []) });
    this.stream = stream;
    stream.on("ready", () => {
      this.status("ok");
      this.forward((f) => f.status("ok"));
    });
    stream.on("tokens", (tokens: SonioxToken[]) => {
      this.failures = 0;
      this.onTokens(tokens);
      if (!this.followers.size) return;
      const own = tokens.filter((t) => t.translation_status !== "translation");
      if (own.length) this.forward((f) => f.onTokens(own));
    });
    stream.on("drop", ({ fatal, reason }: { fatal: boolean; reason: string }) => {
      if (this.stream !== stream) return;
      this.stream = null;
      this.host.billed?.((Date.now() - stream.startedAt) / 1000);
      this.flushOpen();
      this.forward((f) => f.flushOpen());
      log("soniox_drop", { ref: this.host.ref, fatal, reason, failures: this.failures });
      if (fatal) {
        // Bad key / out of credit: stop hammering, tell the reader captions are unavailable.
        this.fatalUntil = Date.now() + 60_000;
        this.status("unavailable");
        this.forward((f) => f.status("unavailable"));
      } else {
        // Video is unaffected; captions resume on the next audio chunk.
        this.failures++;
        this.status("paused");
        this.forward((f) => f.status("paused"));
      }
    });
    const delay = BACKOFF_MS[Math.min(this.failures, BACKOFF_MS.length - 1)];
    if (delay) setTimeout(() => this.stream === stream && stream.start(), delay);
    else stream.start();
  }

  /** Both people see caption health: the reader for "theirs", the speaker for "mine". */
  private status(state: "ok" | "paused" | "unavailable") {
    this.host.toReader({ t: "captions", state, side: "theirs" });
    this.host.toSpeaker({ t: "captions", state, side: "mine" });
  }

  private stopStream(why: string) {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (this.stream) {
      log("soniox_stop", { ref: this.host.ref, why });
      this.host.billed?.((Date.now() - this.stream.startedAt) / 1000);
      this.stream.close();
      this.stream = null;
      // The stream that fed the followers is gone: settle what they have too.
      this.forward((f) => f.flushOpen());
    }
    this.flushOpen();
  }

  // ---------------------------------------------------------------- tokens

  private newUtterance(): Utterance {
    return {
      id: `${this.host.ref}-${this.epoch}-${++this.seq}`,
      origFinal: "",
      origLive: "",
      trFinal: "",
      trLive: "",
      state: "open",
      sealed: false,
      refineDone: false,
      refined: null,
      previewText: "",
      previewSource: "",
      previewInFlight: 0,
      previewAt: 0,
      previewSeq: 0,
      previewShownSeq: 0,
      previewSentAt: 0,
      previewCover: 0,
      previewFrom: -1,
      previewWords: 0,
      steadyWords: 0,
      steadyText: "",
      steadyBusy: false,
      steadyDone: false,
      steadyFails: 0,
    };
  }

  /** Where translation tokens go: the oldest closed utterance still accepting them, else the open one. */
  private translationTarget(): Utterance {
    const c = this.closing.find((u) => !u.sealed);
    if (c) return c;
    return (this.open ??= this.newUtterance());
  }

  private onTokens(tokens: SonioxToken[]) {
    // Non-final tokens are re-sent in full with every response.
    if (this.open) this.open.origLive = "";
    for (const u of this.closing) u.trLive = "";
    if (this.open) this.open.trLive = "";
    const touched = new Set<Utterance>();

    for (const tok of tokens) {
      const isTr = tok.translation_status === "translation";
      if (END_TOKENS.has(tok.text)) {
        if (!isTr && tok.is_final && this.open) {
          touched.add(this.open);
          this.closeOpen();
        }
        continue;
      }
      if (!isTr) {
        const u = (this.open ??= this.newUtterance());
        if (tok.is_final) u.origFinal += tok.text;
        else u.origLive += tok.text;
        touched.add(u);
      } else {
        const u = this.translationTarget();
        if (tok.is_final) u.trFinal += tok.text;
        else u.trLive += tok.text;
        touched.add(u);
        if (u.state === "closing") this.armSeal(u);
      }
    }
    for (const u of touched) this.emit(u);
    if (this.open) {
      this.maybeSteady(this.open);
      this.maybePreview(this.open);
    }
  }

  private get wants() {
    return this.host.styles?.() ?? { steady: true, instant: true };
  }

  /**
   * Settled phrases (both reading styles) need the LLM; without it everyone gets the one
   * Soniox-only version. Live readers get the same phrases plus a faint preview.
   */
  private get steadyOn() {
    const w = this.wants;
    return this.claudeWrites && (w.steady || w.instant);
  }

  private get instantTag(): CaptionStyleTag {
    return this.steadyOn ? "instant" : "all";
  }

  // ------------------------------------------------------- steady captions

  /**
   * The utterance as words (characters for scripts written without spaces), and how many of them
   * are settled: everything except the last couple of words Soniox is still recognising.
   * Waiting for Soniox to mark words final costs 5+ s on continuous speech; its earlier words
   * almost never change once a couple more have been heard.
   */
  /** Verb-final languages: wait longer for a clause boundary, so a phrase usually includes its verb. */
  private get phraseScale() {
    return VERB_FINAL.has(baseLang(this.speaks) ?? "") ? 1.5 : 1;
  }

  private steadyUnits(u: Utterance) {
    const full = u.origFinal + u.origLive;
    const spaced = /\s/.test(full.trim()) || !/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0e00-\u0e7f]/u.test(full);
    const units = spaced ? full.trim().split(/\s+/).filter(Boolean) : Array.from(full.replace(/\s+/g, ""));
    const guard = u.origLive.trim() ? (spaced ? 2 : 3) : /\s$/.test(full) || CLAUSE_END.test(full) ? 0 : 1;
    return { units, sep: spaced ? " " : "", stable: Math.max(0, units.length - guard), scale: spaced ? 1 : 2 };
  }

  /** While they speak: send the next finished phrase for translation when one is ready. */
  private maybeSteady(u: Utterance) {
    if (!this.steadyOn || u.state !== "open" || u.steadyBusy || u.steadyDone) return;
    if (u.steadyTimer) clearTimeout(u.steadyTimer);
    const { units, stable, scale } = this.steadyUnits(u);
    const pending = units.slice(u.steadyWords, stable);
    // End the phrase at the last clause boundary (comma, full stop…) once it has enough words.
    for (let i = pending.length - 1; i + 1 >= STEADY_MIN_WORDS * scale; i--) {
      if (CLAUSE_END.test(pending[i])) return this.steadyPhrase(u, false, i + 1);
    }
    if (pending.length >= Math.round(STEADY_MAX_WORDS * scale * this.phraseScale)) {
      // Don't end a phrase on a joining word ("when", "and", "the"): it belongs with what follows.
      let n = pending.length;
      const lang = baseLang(this.speaks) ?? "";
      if (scale > 1) n = cleanCut(pending, n, lang, STEADY_MIN_WORDS * scale);
      else while (n > STEADY_MIN_WORDS * scale && n > pending.length - 4 && joinsForward(pending[n - 1], lang)) n--;
      // Turkish "bi de" / "bir de" (and another thing) opens what follows: it goes with the next phrase.
      if (ENCLITIC.has(lang) && n - 2 >= STEADY_MIN_WORDS * scale && /^(bi|bir)$/i.test(pending[n - 2]) && /^(de|da)$/i.test(pending[n - 1])) n -= 2;
      return this.steadyPhrase(u, false, n);
    }
    // A short pause mid-sentence also ends a phrase, so the reader isn't kept waiting.
    if (units.length - u.steadyWords >= STEADY_MIN_WORDS * scale) {
      u.steadyTimer = setTimeout(() => this.open === u && !u.steadyBusy && this.steadyPhrase(u, false), STEADY_PAUSE_MS);
    }
  }

  /** Translate the next `count` words (default: everything not yet shown) and append them. */
  private steadyPhrase(u: Utterance, final: boolean, count?: number) {
    const { units, sep } = this.steadyUnits(u);
    const n = final || count === undefined ? units.length - u.steadyWords : count;
    const phrase = units.slice(u.steadyWords, u.steadyWords + Math.max(0, n)).join(sep).trim();
    if (!phrase) return final ? this.steadyEmit(u, true) : undefined;
    u.steadyBusy = true;
    const upTo = u.steadyWords + n;
    phraseTranslate({
      phrase,
      before: units.slice(0, u.steadyWords).join(sep).trim(),
      shown: u.steadyText,
      final,
      // The next few words already heard: lets the translator see the verb that is coming
      // (verb-last languages) without translating it yet.
      ahead: final ? undefined : units.slice(upTo, upTo + 3).join(sep).trim() || undefined,
      sourceLang: this.speaks!,
      targetLang: this.reads!,
      context: this.host.context(),
      people: this.host.people?.(),
      profile: this.host.profile?.(),
      callNames: this.host.callNames?.(),
      callWords: this.host.callWords?.(),
      speakerName: this.host.speakerName?.(),
      signal: AbortSignal.timeout(STEADY_TIMEOUT_MS),
    }).then((text) => {
      u.steadyBusy = false;
      if (u.steadyDone) return;
      // An empty reply for a real phrase (3+ words) is a miss, not "nothing to say": retry it.
      if (text === "" && phrase.split(/\s+/).length >= 3) text = null;
      this.claudeResult(text !== null);
      if (text === null) {
        // Words are never skipped: they go out again with the next phrase. Only a sentence
        // whose closing phrase keeps failing is settled on what is already shown.
        if (++u.steadyFails >= 3 && u.state !== "open") return this.steadyEmit(u, true);
      } else {
        u.steadyFails = 0;
        u.steadyWords = upTo;
        // Never the same words twice: a phrase that starts by repeating the end of the line.
        if (text) text = dropRepeat(u.steadyText, text);
        if (text) u.steadyText = joinText(u.steadyText, text);
        this.steadyEmit(u, false);
      }
      if (u.state === "open") this.maybeSteady(u);
      else this.steadyClose(u);
    });
  }

  /** The utterance ended: translate what's left as the closing phrase, or use the full rewrite. */
  private steadyClose(u: Utterance) {
    if (!this.steadyOn || u.steadyDone || u.steadyBusy) return;
    if (u.steadyTimer) clearTimeout(u.steadyTimer);
    if (!u.steadyText && u.steadyWords === 0) {
      // Short utterance, nothing shown yet: the idiomatic rewrite of the whole thing is the subtitle.
      if (!u.refineDone) return; // called again when it lands
      let text = u.refined;
      if (text === null) {
        if (!u.sealed) return; // called again from seal()
        text = this.literal(u);
        // No backup translation from Soniox: translate it again as one closing phrase (retried).
        if (!text && (u.origFinal + u.origLive).trim()) return this.steadyPhrase(u, true);
      }
      u.steadyText = text.trim();
      return this.steadyEmit(u, true);
    }
    if (this.steadyUnits(u).units.length > u.steadyWords) return this.steadyPhrase(u, true);
    this.steadyEmit(u, true);
  }

  private steadyEmit(u: Utterance, final: boolean) {
    if (final) {
      u.steadyDone = true;
      if (u.steadyText) this.host.settled?.(`${u.id}~s`, (u.origFinal + u.origLive).trim(), u.steadyText);
    }
    // The preview covered words that are now settled: drop it (the next one follows within a second).
    u.previewText = "";
    u.previewSource = "";
    const wants = this.wants;
    if (wants.steady && (u.steadyText || final)) {
      this.host.toReader({ t: "caption", id: `${u.id}~s`, stage: final ? "final" : "steady", text: u.steadyText, style: "steady" });
    }
    if (wants.instant) this.sendLive(u, final);
    if (!final && u.state === "open") this.maybePreview(u);
  }

  /** Count Claude's misses in a row; after a few, Soniox translates again for a while. */
  private claudeResult(ok: boolean) {
    if (ok) {
      this.claudeMisses = 0;
      return;
    }
    if (++this.claudeMisses < CLAUDE_MISSES_FOR_BACKUP || !this.claudeWrites) return;
    this.claudeMisses = 0;
    this.backupUntil = Date.now() + BACKUP_MS;
    log("claude_backup", { ref: this.host.ref, minutes: BACKUP_MS / 60_000 });
    // Settle what's on screen, then reopen with Soniox translating on the next words.
    if (this.open?.steadyText) this.steadyEmit(this.open, true);
    // A follower leaves the shared stream too (it needs one that translates).
    if (!this.sonioxTranslates) this.stopStream("backup");
  }

  private literal(u: Utterance): string {
    if (!this.translating) return (u.origFinal + u.origLive).trim();
    return (u.trFinal + u.trLive).trim();
  }

  /**
   * Live readers: a quick translation of the words after the last shown phrase, drawn faintly
   * after the settled text so the reader isn't waiting for the phrase to finish. It is replaced
   * as they keep talking and disappears when the phrase lands, so only the faint end ever moves.
   */
  private maybePreview(u: Utterance) {
    if (!this.steadyOn || !this.wants.instant || u.state !== "open" || u.steadyDone) return;
    if (u.previewInFlight >= PREVIEW_PARALLEL) return; // picked up again when one lands
    const now = Date.now();
    const wait = u.previewAt + PREVIEW_EVERY_MS - now;
    if (wait > 0) {
      // Check again then, even if no new words arrive meanwhile (the speaker paused).
      u.previewTimer ??= setTimeout(() => {
        u.previewTimer = undefined;
        this.maybePreview(u);
      }, wait);
      return;
    }
    const { units, sep, scale } = this.steadyUnits(u);
    const from = u.steadyWords;
    const tail = units.slice(from);
    if (tail.length < PREVIEW_MIN_WORDS * scale) return;
    // Every couple of words, not every word: a corrected word alone waits for the next ones.
    if (from === u.previewFrom && tail.length - u.previewWords < PREVIEW_STEP_WORDS * scale) return;
    const fragment = tail.join(sep);
    if (fragment === u.previewSource) return;
    // Previews overlap: a new one starts every PREVIEW_EVERY_MS while earlier ones are still being
    // written. Each is numbered; a reply only shows if nothing newer has shown and no phrase
    // has settled meanwhile. Replies stream in, so the first words show before the reply is done.
    const seq = ++u.previewSeq;
    u.previewInFlight++;
    u.previewAt = now;
    u.previewSource = fragment;
    u.previewFrom = from;
    u.previewWords = tail.length;
    const show = (text: string) => {
      if (u.state !== "open" || u.steadyDone || u.steadyWords !== from || seq < u.previewShownSeq) return;
      if (!text || text === u.previewText) return;
      u.previewShownSeq = seq;
      u.previewText = text;
      u.previewCover = from + tail.length;
      // Partial replies arrive a few characters at a time: send at most every PREVIEW_SEND_MS.
      const since = Date.now() - u.previewSentAt;
      if (since >= PREVIEW_SEND_MS) {
        u.previewSentAt = Date.now();
        this.sendLive(u, false);
      } else {
        u.previewSendTimer ??= setTimeout(() => {
          u.previewSendTimer = undefined;
          u.previewSentAt = Date.now();
          if (u.state === "open" && !u.steadyDone) this.sendLive(u, false);
        }, PREVIEW_SEND_MS - since);
      }
    };
    // Same continuation prompt as the settled phrases: it sees the subtitle already shown, so the
    // preview carries on from it instead of re-translating it.
    phraseTranslate({
      phrase: fragment,
      before: units.slice(0, from).join(sep),
      shown: u.steadyText,
      final: false,
      sourceLang: this.speaks!,
      targetLang: this.reads!,
      context: this.host.context(),
      people: this.host.people?.(),
      profile: this.host.profile?.(),
      callNames: this.host.callNames?.(),
      callWords: this.host.callWords?.(),
      speakerName: this.host.speakerName?.(),
      signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS),
      onPartial: show,
    }).then((text) => {
      u.previewInFlight--;
      if (text) show(text);
      // A phrase landed meanwhile: preview what's left, right away.
      if (u.steadyWords !== from) u.previewAt = 0;
      this.maybePreview(u);
    });
  }

  /** The Live version of a line: settled phrases plus the faint preview. */
  private sendLive(u: Utterance, final: boolean) {
    if (!u.steadyText && !u.previewText && !final) return;
    this.host.toReader({
      t: "caption",
      id: `${u.id}~s`,
      stage: final ? "final" : "steady",
      text: u.steadyText,
      tail: final ? undefined : u.previewText || undefined,
      style: "instant",
      // How many source words this line covers (for latency measurement; not sent to phones).
      cover: u.previewText && !final ? u.previewCover : u.steadyWords,
    });
  }

  private emit(u: Utterance) {
    const own = (u.origFinal + u.origLive).trim();
    if (own && own !== u.lastOwnText) {
      u.lastOwnText = own;
      this.host.toSpeaker({ t: "own", id: u.id, text: own, final: u.state !== "open" });
    }
    if (this.translating && this.host.toOriginal && own && own !== u.lastOrigText && u.state === "open") {
      u.lastOrigText = own;
      this.host.toOriginal({ t: "caption", id: `${u.id}-src`, stage: "live", text: own });
    }
    if (u.state === "done" || this.steadyOn) return;
    const text = this.literal(u);
    if (text && text !== u.lastReaderText) {
      u.lastReaderText = text;
      this.host.toReader({ t: "caption", id: u.id, stage: "live", text, style: this.instantTag });
    }
  }

  // ------------------------------------------------------------ utterances

  private closeOpen() {
    const u = this.open;
    this.open = null;
    if (!u) return;
    u.origFinal += u.origLive;
    u.origLive = "";
    const source = u.origFinal.trim();
    if (!source) {
      u.state = "done";
      if (u.lastReaderText) this.host.toReader({ t: "caption", id: u.id, stage: "final", text: "", style: this.instantTag });
      if (u.steadyText || u.previewText) this.steadyEmit(u, true);
      return;
    }
    const context = this.host.context();
    this.host.record({ who: this.host.label, lang: this.speaks!, text: source });
    // Always mark the speaker's own line final, even when its text didn't change at close.
    this.host.toSpeaker({ t: "own", id: u.id, text: source, final: true });
    u.lastOwnText = source;
    if (this.translating && this.host.toOriginal) this.host.toOriginal({ t: "caption", id: `${u.id}-src`, stage: "final", text: source });

    if (!this.translating) {
      u.state = "done";
      this.host.toReader({ t: "caption", id: u.id, stage: "final", text: source, style: "all" });
      return;
    }

    u.state = "closing";
    this.closing.push(u);
    this.armSeal(u);
    u.sealMax = setTimeout(() => this.seal(u), SEAL_MAX_MS);
    this.steadyClose(u);

    // The whole-utterance rewrite serves word-by-word readers, and steady readers when the
    // utterance was short enough that no phrase was shown yet.
    const steadyNeedsRewrite = u.steadyWords === 0 && !u.steadyBusy;
    if (this.steadyOn && !steadyNeedsRewrite) {
      u.refineDone = true;
      return;
    }

    const abort = new AbortController();
    const deadline = setTimeout(() => abort.abort(), REFINE_DEADLINE_MS);
    const closedAt = Date.now();
    refine({
      source,
      sourceLang: this.speaks!,
      targetLang: this.reads!,
      speaker: this.host.label,
      context,
      glossary: this.host.glossary(),
      people: this.host.people?.(),
      profile: this.host.profile?.(),
      callNames: this.host.callNames?.(),
      callWords: this.host.callWords?.(),
      speakerName: this.host.speakerName?.(),
      signal: abort.signal,
    }).then((refined) => {
      clearTimeout(deadline);
      // A late result is discarded: a caption that mutates after the reader moved on is worse.
      if (Date.now() - closedAt > REFINE_DEADLINE_MS) refined = null;
      u.refineDone = true;
      u.refined = refined;
      this.steadyClose(u);
      if (u.state === "done") return;
      if (refined && !isTrivialEdit(this.literal(u), refined)) {
        this.finish(u, "refined", refined);
      } else {
        this.maybeFinish(u);
      }
    });
  }

  private armSeal(u: Utterance) {
    if (u.sealTimer) clearTimeout(u.sealTimer);
    // A translated sentence ending in punctuation with nothing pending is complete.
    const done = !u.trLive && SENTENCE_END.test(u.trFinal);
    // Nothing to wait for when Soniox isn't translating.
    u.sealTimer = setTimeout(() => this.seal(u), !this.sonioxTranslates ? 0 : done ? 150 : SEAL_QUIET_MS);
  }

  private seal(u: Utterance) {
    if (u.sealed) return;
    u.sealed = true;
    u.trFinal += u.trLive;
    u.trLive = "";
    if (u.sealTimer) clearTimeout(u.sealTimer);
    if (u.sealMax) clearTimeout(u.sealMax);
    this.closing = this.closing.filter((x) => x !== u);
    this.maybeFinish(u);
    this.steadyClose(u);
  }

  private maybeFinish(u: Utterance) {
    if (u.state !== "done" && u.refineDone && u.sealed) this.finish(u, "final", this.literal(u));
  }

  private finish(u: Utterance, stage: "final" | "refined", text: string) {
    u.state = "done";
    if (this.steadyOn) return; // steady / live readers get their own version
    this.host.toReader({ t: "caption", id: u.id, stage, text: text.trim(), style: this.instantTag });
    this.host.settled?.(u.id, u.origFinal.trim(), text.trim());
    // Keep it attached until sealed so trailing translation tokens are not misattributed to the next one.
  }

  /** The stream is going away mid-utterance: settle whatever we have. */
  private flushOpen() {
    if (this.open) this.closeOpen();
    for (const u of [...this.closing]) {
      if (!u.refineDone) u.refineDone = true; // the in-flight refine may still land, and is honoured by finish()
      this.seal(u);
    }
  }
}

function joinText(a: string, b: string): string {
  if (!a) return b.trim();
  const sep = /[\u3000-\u9fff\uff00-\uffef]$/u.test(a) ? "" : " ";
  return `${a.trimEnd()}${sep}${b.trim()}`;
}
