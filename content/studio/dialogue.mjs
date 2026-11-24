// What the phone shows in each post: short everyday lines per language, the way a caption would
// read them. o = what was said (their language), e = what the English reader sees.
// A native speaker should check these before a post in that language goes out.
export const LANGS = {
  Turkish: {
    native: "Türkçe", cls: "", names: { g: "Ayşe", w: "Ezgi", m: "Can", k: "Deniz" },
    warm: [["Yemek yedin mi?", "Have you eaten?"], ["Seni çok özledik.", "We've missed you so much."], ["Ne zaman geliyorsunuz?", "When are you coming?"]],
    meet: { them: ["Nerelisin?", "Where are you from?"], me: ["From Brisbane. Nice to meet you.", "Brisbane'liyim. Tanıştığıma memnun oldum."] },
    shop: { me: ["How much is this one?", "Bu ne kadar?"], them: ["Sana özel, iyi bir fiyat.", "For you, a good price."] },
  },
  Vietnamese: {
    native: "Tiếng Việt", cls: "", names: { g: "Lan", w: "Linh", m: "Minh", k: "An" },
    warm: [["Con ăn cơm chưa?", "Have you eaten yet?"], ["Cả nhà nhớ con lắm.", "We all miss you so much."], ["Khi nào con về?", "When are you coming home?"]],
    meet: { them: ["Bạn đến từ đâu?", "Where are you from?"], me: ["From Brisbane. Nice to meet you.", "Tôi đến từ Brisbane. Rất vui được gặp bạn."] },
  },
  Arabic: {
    native: "العربية", cls: "f-ar", rtl: true, names: { g: "Fatima", w: "Layla", m: "Sami", k: "Noor" },
    warm: [["هل أكلت؟", "Have you eaten?"], ["اشتقنا لك كثيراً.", "We've missed you so much."], ["متى ستأتي؟", "When are you coming?"]],
    meet: { them: ["من أين أنت؟", "Where are you from?"], me: ["From Brisbane. Nice to meet you.", "أنا من بريزبن. تشرفت بلقائك."] },
    shop: { me: ["How much is this one?", "بكم هذا؟"], them: ["لك سعر جيد.", "For you, a good price."] },
  },
  Hindi: {
    native: "हिन्दी", cls: "f-hi", names: { g: "Asha", w: "Priya", m: "Arjun", k: "Kabir" },
    warm: [["खाना खाया?", "Have you eaten?"], ["हमें तुम्हारी बहुत याद आती है।", "We miss you so much."], ["कब आ रहे हो?", "When are you coming?"]],
    meet: { them: ["आप कहाँ से हैं?", "Where are you from?"], me: ["From Brisbane. Nice to meet you.", "मैं ब्रिस्बेन से हूँ। आपसे मिलकर खुशी हुई।"] },
  },
  Tagalog: {
    native: "Tagalog", cls: "", names: { g: "Rosa", w: "Maria", m: "Jun", k: "Migs" },
    warm: [["Kumain ka na ba?", "Have you eaten yet?"], ["Miss na miss ka na namin.", "We miss you so much."], ["Kailan ka uuwi?", "When are you coming home?"]],
  },
  Korean: {
    native: "한국어", cls: "f-ko", names: { g: "Soon-ja", w: "Ji-woo", m: "Min-jun", k: "Ha-eun" },
    warm: [["밥 먹었어?", "Have you eaten?"], ["너무 보고 싶어.", "I miss you so much."], ["언제 와?", "When are you coming?"]],
    meet: { them: ["어디에서 오셨어요?", "Where are you from?"], me: ["From Brisbane. Nice to meet you.", "브리즈번에서 왔어요. 만나서 반가워요."] },
  },
  Greek: {
    native: "Ελληνικά", cls: "f-el", names: { g: "Eleni", w: "Sofia", m: "Nikos", k: "Yianni" },
    warm: [["Έφαγες;", "Have you eaten?"], ["Μας έλειψες πολύ.", "We've missed you so much."], ["Πότε θα έρθεις;", "When are you coming?"]],
    meet: { them: ["Από πού είσαι;", "Where are you from?"], me: ["From Brisbane. Nice to meet you.", "Από το Μπρίσμπεϊν. Χάρηκα για τη γνωριμία."] },
  },
  Mandarin: {
    native: "中文", cls: "f-zh", names: { g: "Mei", w: "Lin", m: "Wei", k: "Bao" },
    warm: [["吃饭了吗？", "Have you eaten?"], ["我们很想你。", "We miss you so much."], ["什么时候回来？", "When are you coming home?"]],
    meet: { them: ["你是哪里人？", "Where are you from?"], me: ["From Brisbane. Nice to meet you.", "我来自布里斯班。很高兴认识你。"] },
  },
  Italian: {
    native: "Italiano", cls: "", names: { g: "Rosa", w: "Giulia", m: "Marco", k: "Luca" },
    warm: [["Hai mangiato?", "Have you eaten?"], ["Ci manchi tanto.", "We miss you so much."], ["Quando vieni?", "When are you coming?"]],
    meet: { them: ["Di dove sei?", "Where are you from?"], me: ["From Brisbane. Nice to meet you.", "Sono di Brisbane. Piacere di conoscerti."] },
  },
  Spanish: {
    native: "Español", cls: "", names: { g: "Carmen", w: "Lucía", m: "Diego", k: "Mateo" },
    warm: [["¿Ya comiste?", "Have you eaten yet?"], ["Te extrañamos mucho.", "We miss you so much."], ["¿Cuándo vienes?", "When are you coming?"]],
  },
  Thai: {
    native: "ไทย", cls: "f-th", names: { g: "Malee", w: "Ploy", m: "Somchai", k: "Nong" },
    warm: [["กินข้าวหรือยัง", "Have you eaten yet?"], ["คิดถึงมากนะ", "We miss you so much."], ["จะมาเมื่อไหร่", "When are you coming?"]],
    shop: { me: ["How much is this one?", "อันนี้ราคาเท่าไหร่"], them: ["ให้ราคาพิเศษเลย", "For you, a special price."] },
  },
  Portuguese: {
    native: "Português", cls: "", names: { g: "Ana", w: "Beatriz", m: "João", k: "Tiago" },
    warm: [["Já comeu?", "Have you eaten?"], ["Estamos com saudades.", "We miss you."], ["Quando você vem?", "When are you coming?"]],
  },
  Japanese: {
    native: "日本語", cls: "f-ja", names: { g: "Yoko", w: "Yuki", m: "Kenji", k: "Sora" },
    warm: [["ご飯食べた？", "Have you eaten?"], ["会いたいよ。", "I miss you."], ["いつ来るの？", "When are you coming?"]],
    shop: { me: ["How much is this one?", "これはいくらですか？"], them: ["こちらがおすすめです。", "I recommend this one."] },
  },
  Punjabi: {
    native: "ਪੰਜਾਬੀ", cls: "f-pa", names: { g: "Harpreet", w: "Simran", m: "Gurpreet", k: "Jas" },
    warm: [["ਰੋਟੀ ਖਾਧੀ?", "Have you eaten?"], ["ਤੇਰੀ ਬਹੁਤ ਯਾਦ ਆਉਂਦੀ ਹੈ।", "We miss you so much."], ["ਕਦੋਂ ਆ ਰਹੇ ਹੋ?", "When are you coming?"]],
  },
  Azerbaijani: {
    native: "Azərbaycanca", cls: "", names: { g: "Gülnar", w: "Aysel", m: "Elçin", k: "Tural" },
    warm: [["Yemək yedin?", "Have you eaten?"], ["Sənin üçün çox darıxmışıq.", "We've missed you so much."], ["Nə vaxt gəlirsən?", "When are you coming?"]],
  },
  Russian: {
    native: "Русский", cls: "", names: { g: "Olga", w: "Anya", m: "Ivan", k: "Misha" },
    warm: [["Ты поел?", "Have you eaten?"], ["Мы очень скучаем.", "We miss you so much."], ["Когда приедешь?", "When are you coming?"]],
  },
};
/** When the post quotes the line itself ("Nene says 'x'; Max's captions read 'y'"), the phone shows exactly that. */
export function quoted(post) {
  const m = post.mechanic.split("captions read '");
  if (m.length < 2) return null;
  let read = m[1].slice(0, m[1].lastIndexOf("'"));
  read = read[0].toUpperCase() + read.slice(1) + (/[.!?]$/.test(read) ? "" : ".");
  const said = m[0].match(/(?:says|yells) '(.+)'/);
  return { said: said ? said[1] : null, read };
}
/** Posts whose phone shows a different language from the first one their words name. */
const OVERRIDE = { S054: "Arabic" };
const ORDER = Object.keys(LANGS);
export function langOf(post) {
  if (OVERRIDE[post.post_id]) return OVERRIDE[post.post_id];
  const t = ["hook", "old_way", "cost", "mechanic", "change", "caption", "tiktok_caption", "voiceover_script"].map((k) => post[k]).join(" ");
  let best = null, at = Infinity;
  for (const l of ORDER) { const i = t.search(new RegExp(`\\b${l}\\b`)); if (i >= 0 && i < at) { at = i; best = l; } }
  // The mechanic line names the language on the phone when it names one.
  for (const l of ORDER) if (new RegExp(`\\b${l}\\b`).test(post.mechanic)) return l;
  return best || "Turkish";
}
