import Anthropic from "@anthropic-ai/sdk";
import { baseLang, langInfo } from "../shared/lang";
import type { SpeakerProfile } from "../shared/protocol";
import { log } from "./log";
import { vocabExtra } from "./vocab";

export type ContextLine = { who: string; lang: string; text: string };

/**
 * "English (Australia)" rather than "English": slang depends on where the speaker is from
 * ("pissed" is drunk in Australia and Britain, angry in America; "thongs" are flip-flops).
 */
function langName(code: string): string {
  const name = langInfo(code).name;
  const region = code.split("-")[1];
  if (!region) return name;
  try {
    const r = new Intl.DisplayNames(["en"], { type: "region" }).of(region.toUpperCase());
    return r && r !== region ? `${name} (${r})` : name;
  } catch {
    return name;
  }
}

/** What the people in this caption pipeline told us about themselves (all optional). */
export type People = { speaker?: "m" | "f"; listener?: "m" | "f" };

/**
 * Only pass a gender when the words need it: from English, the speaker's when they talk about
 * themselves ("I…", or thanks: Portuguese "obrigada") and the listener's when they're addressed
 * ("you"). Otherwise a small model tends to put the speaker's gender on everyone in the sentence
 * ("my teacher was happy with us" coming out feminine). Other source languages mark person in
 * verb endings, so the gender is always passed and the prompt rules apply.
 */
export function relevantPeople(text: string, sourceLang: string, p: People | undefined): People | undefined {
  if (!p || baseLang(sourceLang) !== "en") return p;
  const speaker = p.speaker && /\b(I|I'm|I've|I'll|I'd|thanks?)\b/i.test(text) ? p.speaker : undefined;
  const listener = p.listener && /\b(you|you're|you've|you'll|you'd|your|yours|yourself)\b/i.test(text) ? p.listener : undefined;
  return speaker || listener ? { speaker, listener } : undefined;
}

/** What the speaker told us about themselves in their profile (all optional). */
function profileTag(p: SpeakerProfile | undefined): string {
  if (!p) return "";
  const parts: string[] = [];
  if (p.from) {
    let country = p.from;
    try {
      country = new Intl.DisplayNames(["en"], { type: "region" }).of(p.from) ?? p.from;
    } catch {}
    parts.push(`From: ${country} (their accent and slang).`);
  }
  if (p.topics?.length) parts.push(`Often talks about: ${p.topics.join(", ")}.`);
  if (p.words?.length) parts.push(`Names and words they use (spell them this way): ${p.words.join(", ")}.`);
  return parts.length ? `<speaker_profile>${parts.join(" ")}</speaker_profile>` : "";
}

function peopleTag(p: People | undefined): string {
  const parts: string[] = [];
  const sp = p?.speaker === "f" ? ["a woman", "feminine", "she", "herself"] : p?.speaker === "m" ? ["a man", "masculine", "he", "himself"] : null;
  const li = p?.listener === "f" ? ["a woman", "feminine", "she"] : p?.listener === "m" ? ["a man", "masculine", "he"] : null;
  if (sp) parts.push(`The speaker is ${sp[0]}: use ${sp[1]} forms only where ${sp[2]} refers to ${sp[3]} alone (I, me, my). This says nothing about "we" or "us", or about anyone ${sp[2]} mentions (friends, teachers, colleagues, family): for them use the context, else neutral wording or the grammatical default.`);
  if (li) parts.push(`The listener is ${li[0]}: use ${li[1]} forms only where ${li[2]} alone is addressed as "you".`);
  return parts.length ? `<people>${parts.join(" ")}</people>` : "";
}

export type RefineInput = {
  /** Finalised source-language transcript of the utterance (not the machine translation). */
  source: string;
  sourceLang: string;
  targetLang: string;
  /** Which participant is speaking, matching the labels used in `context`. */
  speaker: string;
  /** Up to the last 6 utterances of the conversation, both sides, oldest first. */
  context: ContextLine[];
  glossary: Record<string, string>;
  people?: People;
  profile?: SpeakerProfile;
  signal: AbortSignal;
};

const MODEL = process.env.REFINE_MODEL ?? "claude-haiku-5-5";

const SYSTEM = `You write the subtitles for a live, face-to-face video call between two people who do not share a language. Each turn you get one thing a person just said, transcribed from their speech, and you write it in the target language the way a native speaker would actually say it in conversation.

- Translate meaning, not words. Idioms, slang, figures of speech and colloquialisms become the natural equivalent in the target language; where there is none, say plainly what was meant.
- Keep the speaker's register and tone. Casual stays casual, teasing stays teasing, affectionate stays affectionate, blunt stays blunt. Do not soften, formalise or censor.
- The transcript comes from speech recognition and can contain mistakes, fillers and false starts. Use the recent conversation to work out what was meant. Drop fillers that carry no meaning.
- Speech recognition often mishears names, characters, brands, places and slang, especially in accents or soft speech ("pin okio" for Pinocchio, "chillin like a villain" split oddly, a name spelled like ordinary words). When a word or phrase looks like a mishearing of a well-known name or saying, translate what was clearly meant. Names of people and characters are kept (or written the way the target language usually writes them).
- Keep it as short as the natural spoken version. It is read as a subtitle while watching the speaker's face.
- Never add anything that wasn't said: no extra items, words, sentences or explanations, even if they seem helpful.
- Glossary entries are names, nicknames and in-jokes between these two people. Use them as given. <speaker_profile> says where the speaker is from, what they often talk about and names and words they use: use it to read their slang and spell their words.
- Some words mean different things by region or context (Australian "footy" is AFL in most states but rugby league in New South Wales and Queensland; "football" differs by country). Decide from the conversation, the speaker's region and topics; if it is still unclear, keep the neutral meaning ("football", "the game") rather than guessing.
- Gender: <people> gives the speaker's and listener's gender. Use the speaker's only where the speaker refers to themselves (I, me, my: Russian "я устала", Portuguese "obrigada", Hindi "मैं गई"), and the listener's only where they are addressed as one person (you: Arabic "أنتِ", Spanish "¿estás cansada?"). Everyone else follows the conversation: people mentioned get the gender the context gives them, groups stay plural ("Are they coming?" about several people), "we" is the group, and where nothing says otherwise use neutral wording or the grammatical default. Never put the speaker's or listener's gender on anyone else: a woman saying "My friend is tired" in French is "Mon ami est fatigué" (the friend's gender is unknown), not "Mon amie est fatiguée". The source can show gender too (Russian past tenses, Hindi and Urdu verb endings, Thai "ครับ"/"ค่ะ", Arabic and Hebrew verb forms): use those clues. Never add a gender the source doesn't have: Turkish "o", Persian "u", Indonesian "dia", spoken Chinese "tā" become "they" (or the person's name) in English, never "he/she" or a slash. Example: "O da geliyor mu?" is "Are they coming too?", not "Is he coming too?".
- Render interjections and backchannels ("mm-hmm", "uh-huh", "wow", "oh no") with the target language's own spoken equivalent, never the source-language sound.
- Your whole reply appears on screen as the subtitle, so reply with the translation only, written in the target language and its usual script: no quotes, notes, alternatives, transliteration, second attempts or explanations. If the utterance has no translatable content, reply with it unchanged.`;

/**
 * Shared reference for both prompts: everyday slang and spoken particles in the app's main languages.
 * Static text placed last in the system prompt and marked for caching, so it adds no per-call latency
 * once warm (Haiku 5.5 caches prompts of 512+ tokens; this keeps both prompts above that).
 */
const SLANG = `<spoken_language_reference>
People on these calls talk casually: friends, families, teammates. Below are common slang words, particles and set phrases by language. They are examples, not a complete list. They are written in Latin letters here, but the transcript uses each language's own script, and speech recognition may spell them oddly. Read them by meaning, and when the target language has its own casual equivalent at the same register, use it.

English is spoken differently by region; <languages> may say which (Australia, United Kingdom, United States). The same word can differ: "pissed" = drunk (Australia, UK) but angry (US); "pants" = trousers (US) or underwear / rubbish (UK); "thongs" = flip-flops (Australia: "grab your thongs" is just "grab your flip-flops", nothing added); "fanny pack" vs "bum bag"; "football" = soccer (UK), American football (US); in Australia "footy" is AFL in most states and rugby league in New South Wales and Queensland, so it depends on context.
English, Australian: "arvo" = afternoon; "brekkie" = breakfast; "servo" = petrol station; "bottle-o" = liquor shop; "Maccas" = McDonald's; "bathers", "togs", "cossie" = swimsuit; "esky" = cooler box; "ute" = pickup; "sanga" = sandwich; "snag" = sausage; "barbie" = barbecue; "stubby" = small bottle of beer; "tinny" = can of beer (or small boat); "goon" = cheap cask wine; "cuppa" = cup of tea; "smoko" = short break; "tradie" = tradesperson; "rellies" = relatives; "lollies" = sweets; "bikkie" = biscuit; "sunnies" = sunglasses; "trackies" = tracksuit pants; "mozzie" = mosquito; "durry" = cigarette; "dunny" = toilet; "doona" = duvet; "uni" = university; "g'day" = hi; "how ya going?" = how are you?; "mate" = friend (also neutral address); "reckon" = think; "heaps" = lots, very; "keen" = up for it; "stoked" = thrilled; "no worries", "no wukkas", "no dramas" = no problem, you're welcome; "she'll be right", "she's apples" = it'll be fine; "fair dinkum" = genuine, really?; "fair enough" = OK, understood; "deadset" = truly; "bloody oath", "too right" = absolutely; "yeah nah" = no; "nah yeah" = yes; "ripper", "bonza", "sweet as" = great; "how good is that!" = that's great; "flat out", "flat chat" = very busy; "full on" = intense; "chockers" = packed full; "dodgy" = shady, poor quality; "suss it out" = figure it out; "rock up" = turn up; "my shout" = I'm paying; "chuck a sickie" = take a fake sick day; "chuck a U-ey" = do a U-turn; "hard yakka" = hard work; "spewin'" = really annoyed; "devo" = devastated; "stuffed", "rooted", "knackered" = exhausted (or broken); "carked it" = died, broke down; "strewth", "crikey" = wow; "bogan" = uncouth person; "daggy" = dorky; "drongo", "galah" = idiot; "Straya" = Australia; "Aussie" = Australian; "Kiwi" = New Zealander; "pom", "pommy" = English person.
English, British: "innit" = isn't it, right?; "bruv", "mate", "pal" = friend; "cheers" = thanks, bye; "ta" = thanks; "knackered" = exhausted; "gutted" = devastated; "chuffed" = pleased; "skint" = broke; "quid" = pound(s); "fiver", "tenner" = £5, £10; "gobsmacked" = astonished; "taking the piss", "taking the mick" = mocking; "having a laugh" = joking; "can't be arsed" = can't be bothered; "cheeky" = playfully bold; "sorted" = done, fixed; "proper", "well" = very ("well good"); "fit" = attractive; "peng" = attractive, great; "minging" = gross; "wagwan" = what's up; "mandem" = the guys; "bare" = lots of; "allow it" = drop it; "peak" = bad luck; "Bob's your uncle" = and that's it; "fortnight" = two weeks; "loo" = toilet; "queue" = line.
English, American and online: "no cap" = honestly, no lie; "cap" = a lie; "bet" = OK, deal; "facts" = true, I agree; "lowkey" = a bit, secretly; "highkey" = openly, very; "deadass", "on God" = seriously, I swear; "say less" = got it, say no more; "slaps", "fire", "lit", "bussin'" (food) = great; "mid" = mediocre; "sus" = suspicious; "salty" = bitter, annoyed; "tilted" = frustrated, thrown off (from gaming); "it's giving…" = it looks/feels like…; "ate", "slay" = did great; "rizz" = charm; "simp" = overly devoted; "ghosted" = stopped replying; "situationship" = undefined relationship; "delulu" = delusional; "drip" = stylish clothes; "bougie" = fancy; "extra" = over the top; "shook" = shocked; "spill the tea" = share the gossip; "GOAT" = greatest of all time; "W" / "L" = win / loss; "touch grass" = go outside, get real; "based" = admirably yourself; "cringe" = embarrassing; "built different" = exceptional; "rent free" = can't stop thinking about it; "glow up" = big improvement; "caught in 4K" = caught red-handed; "no shot" = no way; "I'm dead", "I'm crying" = that's hilarious; "finna" = going to; "y'all" = you all; "bruh", "fam" = friend, mate; "hella" = very; "chillin'" = relaxing, hanging out; "chillin' like a villain" = relaxing (playful rhyme); "kick it" = hang out; "my bad" = sorry; "gonna/wanna/gotta" = going to / want to / have to.
Rhymes, catchphrases and set phrases ("see you later, alligator", "easy peasy lemon squeezy", "chillin' like a villain", "winner winner chicken dinner") are translated by meaning and playfulness, not word for word; keep the playful tone if the target language has a similar phrase.
Turkish: "kanka", "kanki" = buddy; "abi", "abla" = bro, sis (also polite for an older person); "lan" = dude (rough, between friends); "valla" = honestly; "aynen" = exactly; "eyvallah" = thanks, cheers; "hadi ya", "yok artık" = no way; "kolay gelsin" = greeting to someone working; "eline sağlık" = thanks for the food, nice work; "geçmiş olsun" = sorry that happened, get well; "afiyet olsun" = enjoy your meal; "kafayı yemek" = to go crazy; "boş yapma" = stop talking nonsense; "efsane" = legendary; "çok fena" = awesome or awful, by context; "hocam" = coach, teacher, or a friendly respectful "mate" (by context, never left as "hocam"); "naber", "ne haber" = what's up; "iyiyim" = I'm good; "sağ ol", "saol" = thanks; "kusura bakma" = sorry; "boşver" = never mind; "tamam", "olur" = OK; "hı hı" = yeah; "yok" = no, there isn't; "hadi" = come on, let's go; "of ya" = ugh. Turkish has one word, "o", for he, she and it: in English use the person's name or "they" unless the conversation makes it clear. English "you" to Turkish: "sen" between friends, family and teammates, "siz" for strangers, elders or to show respect; follow the conversation's tone and stay consistent.
Russian: "блин" = damn; "короче" = anyway, long story short; "ну" = well; "давай" = come on, OK, bye; "чё" = what; "прикол" = funny thing, joke; "кайф" = bliss; "норм" = fine; "жесть", "капец" = insane, crazy; "забей" = forget it; "ваще" = totally.
Spanish: "tío/tía" (Spain), "güey/wey" (Mexico), "che" (Argentina), "pana" (Venezuela, Caribbean) = dude; "vale" = OK; "guay", "chévere", "padre", "bacán" = cool; "neta" = really; "ni modo" = oh well; "me vale" = I don't care.
Portuguese (Brazil): "cara", "mano" = dude; "beleza" = cool, OK; "valeu" = thanks; "né" = right?; "tipo" = like; "nossa" = wow; "tô de boa" = I'm chill; "saudade" = missing someone; "gambiarra" = makeshift fix.
Arabic: "yalla" = come on, let's go; "wallah" = I swear, really; "inshallah" = hopefully (often a polite maybe); "mashallah" = wonderful; "habibi/habibti" = dear, buddy; "khalas" = enough, done; "ya'ni" = I mean, like; "tamam" = OK; "mafi mushkila", "ma fi mushkila" = no problem; "shlonak", "ezayak" = how are you (Gulf, Egyptian).
Hindi and Urdu: "yaar" = buddy; "accha" = OK, really?; "arre" = hey, oh; "bas" = enough, that's it; "chalo" = OK, let's go; "theek hai" = OK; "pakka" = for sure; "jugaad" = clever hack; "bindaas" = carefree, cool; "timepass" = killing time; "kya scene hai" = what's up.
Bengali: "dada", "didi" = older brother, sister (also friendly address); "ki obostha" = what's up; "jhamela" = hassle; "adda" = long chat with friends; "bhalo" = good.
Indonesian: "gue/gw", "lo/lu" = I, you (casual); "anjir", "anjay" = damn, wow; "santai" = relax; "gokil" = crazy, awesome; "mager" = too lazy to move; "baper" = taking it personally; "otw" = on the way; "wkwk" = haha; the particles "sih", "dong", "deh", "kok" soften or stress and rarely need words of their own.
French: "wesh" = hey, yo; "frérot", "frère" = bro; "grave" = totally; "ouf" = crazy; "kiffer" = to love; "chelou" = weird; "relou" = annoying; "bof" = meh; "du coup" = so; "genre" = like; "c'est chaud" = it's intense, tough.
Chinese: "牛", "牛逼" = awesome; "绝了" = amazing; "666" = nice one; "yyds", "永远的神" = the greatest; "躺平" = giving up on the rat race; "内卷" = rat race; "靠谱" = reliable; "加油" = come on, you've got this; "没事" = no worries; "随便" = whatever.
German: "Alter", "Digga" = dude; "krass" = crazy, intense; "geil" = awesome; "na?" = what's up?; "Bock haben" = to feel like it; "passt" = fine, works; "Moin" = hi; "Feierabend" = done for the day.
Italian: "dai" = come on; "boh" = no idea; "figo" = cool; "raga" = guys; "magari" = I wish, maybe; "che palle" = what a drag; "ci sta" = fair enough; "mi raccomando" = make sure, take care.
Japanese: "やばい" = crazy (awesome or terrible, by context); "マジ" = seriously; "なるほど" = I see; "お疲れ様" = good work, thanks; "よろしく" = nice to meet you, please; the particles ね and よ add "right?" or emphasis; "えっと" is a filler.
Korean: "대박" = awesome; "진짜" = really; "헐" = OMG; "화이팅" = you've got this; "아이고" = oh dear; "오빠", "언니", "형", "누나" are older brother/sister forms of address: use the name or "mate".
Vietnamese: "ơi" calls someone ("Lan ơi" = hey Lan); "trời ơi" = oh my god; "nha", "nhé" soften; "anh", "em", "chị" are age-based I/you: translate as I/you.
Thai: "ครับ" / "ค่ะ" are politeness particles (and show the speaker is a man / woman): don't translate them as words; "ไม่เป็นไร" = no worries; "สบาย ๆ" = relax, easy; "จริงดิ" = for real?
Persian: "دمت گرم" = thanks, nice one; "خسته نباشی" = greeting to someone working; "باشه" = OK; "قربونت برم" = affectionate thanks, love you; ritual politeness (taarof) means offers may be refused out of courtesy.
Polish: "spoko" = cool, fine; "kurde", "kurczę" = damn; "ziom" = bro; "masakra" = a disaster or crazy; "luz" = chill.
Dutch: "gezellig" = cosy, fun; "lekker" = nice; "joh" = man; "toch?" = right?; "doei" = bye; "gaaf" = cool.
Ukrainian: "та ну" = no way; "кльово" = cool; "ну" = well; "давай" = OK, bye; "файно" = great.
Greek: "ρε" = hey, man; "έλα" = come on, or hello on the phone; "άντε" = come on, let's go; "μαλάκα" = dude between close friends, an insult otherwise; "ωραίος" = cool.
Hebrew: "סבבה" = cool, OK; "יאללה" = come on; "אחי" = bro; "תכלס" = bottom line; "וואלה" = really.
Swahili: "poa" = cool; "sawa" = OK; "mambo" = what's up; "hakuna matata" = no worries; "pole" = sorry (sympathy).
Tagalog: "pre", "pare" = buddy; "sige" = OK, go ahead; "grabe" = wow, intense; "lodi" = idol; "po" and "opo" show respect, not words; mixing English (Taglish) is normal.
Malay: "lah" softens or stresses; "boleh" = can, OK; "best" = great; "geng" = buddy.
Romanian: "frate" = bro; "mișto" = cool; "nasol" = bad; "hai" = come on; "las-o baltă" = forget it.
Czech: "jo" = yeah; "v pohodě" = all good; "hustý" = cool; "kámo" = buddy; "fakt" = really.
Swedish: "typ" = like; "asså" = I mean, like; "fika" = coffee break; "lagom" = just right; "schysst" = nice.
Hungarian: "szia" = hi, bye; "király" = awesome; "haver" = buddy; "jó" = good, OK.
Mixing languages in one sentence (Hinglish, Taglish, Turkish or Arabic with English words) is normal: translate the meaning of the whole. Politeness particles and fillers carry tone, not words.
Terms of address (yaar, abi, habibi, dada, güey, kanka, frérot) become the target language's own (mate, bro, dear), not the original word, unless the listener's language uses it too.
Sports talk (volleyball and others): keep the terms players of the target language really use; many are borrowed from English ("spike", "set", "libero", "timeout"), so use those rather than a literal translation.
</spoken_language_reference>`;

/**
 * Last line of defence for what reaches the screen: with thinking off, a model can occasionally
 * second-guess itself in the visible reply ("Wait, the target is English…"). Keep the final
 * subtitle line and drop anything that reads as a note to itself.
 */
export function subtitleOnly(text: string): string {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^(wait|note|actually|hmm|let me|i should|i need|translation\s*:|subtitle\s*:)/i.test(l));
  const line = lines.length > 1 ? lines[lines.length - 1] : (lines[0] ?? "");
  // A continuation sometimes opens with "..." — the screen shows it joined to what came before.
  let out = line.replace(/^(\.\.\.|…)\s*/u, "").trim();
  // A subtitle wrapped in quotes as a whole: drop the quotes (quotes inside are kept).
  const q = out.match(/^["“„«'‘](.+)["”»'’]$/su);
  if (q && !/["“”«»]/u.test(q[1])) out = q[1].trim();
  return out;
}

/**
 * True when a "translation" is really the source handed back (same words), e.g. Turkish in,
 * Turkish out. Treated as a failure so it is retried or replaced, never shown as a caption.
 */
export function looksUntranslated(source: string, out: string): boolean {
  // The test mocks echo their input on purpose.
  if (process.env.ECHO_CHECK === "off") return false;
  const words = (t: string) => t.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const a = words(source);
  const b = words(out);
  if (a.length < 3 || b.length < 3) return false; // names, "OK", short loanwords are fine
  const src = new Set(a);
  const same = b.filter((w) => src.has(w)).length;
  return same / b.length >= 0.8;
}

/** The slang reference plus approved additions from reports (server/vocab.ts, /data/vocab-extra.json). */
function slangReference(): string {
  const add = Object.entries(vocabExtra().slang ?? {}).flatMap(([lang, lines]) => lines.map((l) => `${langInfo(lang).name}: ${l}`));
  if (!add.length) return SLANG;
  return SLANG.replace("</spoken_language_reference>", `Added from real calls:\n${add.join("\n")}\n</spoken_language_reference>`);
}

let client: Anthropic | null = null;
let warned = false;

export function refineConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** Pass 2: idiomatic rewrite of one finalised utterance. Returns null on any failure. */
export async function refine(input: RefineInput): Promise<string | null> {
  if (!refineConfigured()) {
    if (!warned) log("refine_disabled", { reason: "ANTHROPIC_API_KEY not set" });
    warned = true;
    return null;
  }
  client ??= new Anthropic();
  const src = langName(input.sourceLang);
  const tgt = langName(input.targetLang);
  const glossary = Object.entries(input.glossary);
  const context = input.context.map((c) => `${c.who} (${langInfo(c.lang).name}): ${c.text}`).join("\n");

  const user = [
    `<languages>${src} to ${tgt}</languages>`,
    glossary.length ? `<glossary>\n${glossary.map(([k, v]) => `${k} = ${v}`).join("\n")}\n</glossary>` : "",
    context ? `<recent_conversation>\n${context}\n</recent_conversation>` : "",
    peopleTag(relevantPeople(input.source, input.sourceLang, input.people)),
    profileTag(input.profile),
    `<utterance speaker="${input.speaker}">${input.source}</utterance>`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const started = Date.now();
  try {
    const res = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 400,
        // Latency matters more than depth here: a subtitle rewrite needs no reasoning pass.
        thinking: { type: "disabled" },
        output_config: { effort: "medium" },
        system: [{ type: "text", text: SYSTEM }, { type: "text", text: slangReference(), cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: user }],
      },
      { signal: input.signal, maxRetries: 0 },
    );
    if (res.stop_reason === "refusal") {
      log("refine_refused", { ms: Date.now() - started });
      return null;
    }
    const raw = res.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("");
    const text = subtitleOnly(raw);
    if (text && looksUntranslated(input.source, text)) {
      log("refine_untranslated", { ms: Date.now() - started, src: input.sourceLang, tgt: input.targetLang });
      return null;
    }
    log("refine_ok", { ms: Date.now() - started, src: input.sourceLang, tgt: input.targetLang, cached: res.usage.cache_read_input_tokens ?? 0 });
    return text || null;
  } catch (err) {
    const aborted = input.signal.aborted;
    log(aborted ? "refine_late" : "refine_error", { ms: Date.now() - started, error: aborted ? undefined : String(err) });
    return null;
  }
}

const PHRASE_SYSTEM = `You write the subtitles for a live video call between people who do not share a language. People here often talk for a long time without pausing, so the subtitle is built phrase by phrase: each turn you get the next finished phrase of what the speaker is saying, and your translation is added after the subtitle already on screen. Nothing on screen is ever changed afterwards, so the reader only ever reads each part once.

- Translate only the new phrase, so that it reads as the natural continuation of the subtitle already shown. Never repeat, correct or rephrase what is already shown. Because of word order, the subtitle so far may already carry part of this phrase's meaning (a "when", "that" or "and" placed earlier); don't translate that part again.
- Translate meaning, not words. Idioms, slang and colloquialisms become the natural equivalent in the target language; keep the speaker's register and tone. Drop fillers and false starts that carry no meaning. Never add anything that wasn't said.
- If the phrase stops mid-sentence, stop there too; do not guess what comes next. In languages where the verb comes last (Turkish, Hindi, Urdu, Bengali, Japanese, Korean), a phrase often arrives before its verb: translate only what is there and never invent the missing verb; it comes with the next phrase, so place it naturally then. When the phrase is marked final, it is the end of what they said: finish the sentence naturally.
- Words that differ by region or context (Australian "footy": AFL or rugby league) follow the conversation and <speaker_profile>; if still unclear, keep the neutral meaning rather than guessing.
- Gender: <people> gives the speaker's and listener's gender. Apply the speaker's only where they refer to themselves (I, me, my) and the listener's only where they are addressed as one person (you). Everyone else follows the conversation: groups stay plural, people mentioned get the gender the context gives them, otherwise neutral wording. Never put the speaker's gender on a friend, colleague or anyone else they mention. Clues in the source (verb endings, Thai "ครับ"/"ค่ะ") count too. Never add a gender the source doesn't have: Turkish "o", Indonesian "dia" and similar become just "they" (or the person's name) in English, never "he/she".
- The transcript comes from speech recognition and can contain mistakes, especially names, characters and slang in accents or soft speech ("pin okio" for Pinocchio). Use what was said before and the recent conversation to work out what was meant, but translate only the new phrase.
- When nothing tells you someone's gender and the target language marks it, prefer phrasing that avoids committing to one, otherwise use the grammatical default.
- Your whole reply appears on screen: the translation of the new phrase only, in the target language and its usual script, with no notes or alternatives. Only if the phrase is nothing but fillers ("um", "you know"), reply with nothing.`;

export type PhraseInput = {
  /** The next finished phrase of the utterance, in the source language. */
  phrase: string;
  /** What the speaker already said earlier in this utterance (source language). */
  before: string;
  /** The subtitle already on screen for this utterance (target language). */
  shown: string;
  /** This phrase ends what they said. */
  final: boolean;
  sourceLang: string;
  targetLang: string;
  context: ContextLine[];
  people?: People;
  profile?: SpeakerProfile;
  signal: AbortSignal;
  /** Stream the reply: called with the subtitle so far as the words are written (Live previews). */
  onPartial?: (text: string) => void;
};

/** The first line of a reply still being written, cleaned like a finished one. Empty while unsure. */
function partialSubtitle(raw: string): string {
  const first = raw.split("\n")[0];
  if (/^(wait|note|actually|hmm|let me|i should|i need|translation\s*:|subtitle\s*:)/i.test(first.trim())) return "";
  return first.replace(/^\s*(\.\.\.|…)\s*/u, "").replace(/^["“„«'‘]/u, "").trim();
}

/**
 * Steady captions: translate one finished phrase of a long utterance as a continuation of the
 * subtitle already shown, so text is only ever appended, never rewritten. Null on failure;
 * an empty string when the phrase needs no subtitle.
 */
export async function phraseTranslate(input: PhraseInput): Promise<string | null> {
  if (!refineConfigured()) return null;
  client ??= new Anthropic();
  const src = langName(input.sourceLang);
  const tgt = langName(input.targetLang);
  const context = input.context.map((c) => `${c.who} (${langInfo(c.lang).name}): ${c.text}`).join("\n");
  const user = [
    `<languages>${src} to ${tgt}</languages>`,
    context ? `<recent_conversation>\n${context}\n</recent_conversation>` : "",
    peopleTag(relevantPeople(`${input.before.split(/\s+/).slice(-12).join(" ")} ${input.phrase}`, input.sourceLang, input.people)),
    profileTag(input.profile),
    input.before ? `<said_so_far>${input.before}</said_so_far>` : "",
    input.shown ? `<subtitle_so_far>${input.shown}</subtitle_so_far>` : "",
    `<new_phrase final="${input.final}">${input.phrase}</new_phrase>`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const started = Date.now();
  const params = {
    model: MODEL,
    max_tokens: 300,
    thinking: { type: "disabled" as const },
    output_config: { effort: "medium" as const },
    system: [{ type: "text" as const, text: PHRASE_SYSTEM }, { type: "text" as const, text: slangReference(), cache_control: { type: "ephemeral" as const } }],
    messages: [{ role: "user" as const, content: user }],
  };
  try {
    let res: Anthropic.Message;
    if (input.onPartial) {
      // Live previews: show the words as they are written instead of after the whole reply.
      const stream = client.messages.stream(params, { signal: input.signal, maxRetries: 0 });
      let acc = "";
      let firstAt = 0;
      stream.on("text", (delta) => {
        acc += delta;
        firstAt ||= Date.now() - started;
        const partial = partialSubtitle(acc);
        if (partial) input.onPartial!(partial);
      });
      res = await stream.finalMessage();
      if (firstAt) log("phrase_first_text", { ms: firstAt });
    } else {
      res = await client.messages.create(params, { signal: input.signal, maxRetries: 0 });
    }
    if (res.stop_reason === "refusal") return null;
    const raw = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    log("phrase_ok", { ms: Date.now() - started, chars: input.phrase.length, final: input.final, cached: res.usage.cache_read_input_tokens ?? 0 });
    // Test harness only: never set in production, where no words of a conversation are logged.
    if (process.env.DEBUG_PHRASES === "1") console.log(JSON.stringify({ phrase: input.phrase, final: input.final, out: raw }));
    const text = subtitleOnly(raw);
    if (text && looksUntranslated(input.phrase, text)) {
      log("phrase_untranslated", { ms: Date.now() - started });
      return null;
    }
    return text;
  } catch (err) {
    log(input.signal.aborted ? "phrase_late" : "phrase_error", { ms: Date.now() - started, error: input.signal.aborted ? undefined : String(err) });
    return null;
  }
}
