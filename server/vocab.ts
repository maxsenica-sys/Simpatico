import { existsSync, readFileSync, statSync } from "node:fs";
import { baseLang } from "../shared/lang";
import { soundsAlike } from "../shared/soundalike";
import { dataFile } from "./store";

/**
 * Recognition context for Soniox (sent once when each speech stream opens): the setting, the
 * names of the people in the call, and words a speech recogniser tends to mishear or misspell
 * (slang, characters, sport). Soniox allows ~10,000 characters; we stay well under.
 * https://docs.soniox.com/stt/concepts/context
 */
export type SonioxContext = { general: { key: string; value: string }[]; terms: string[] };

const ENGLISH: string[] = [
  // Australian
  "arvo", "brekkie", "servo", "bottle-o", "Maccas", "thongs", "bathers", "togs", "cossie", "esky", "ute", "sanga", "snag",
  "barbie", "stubby", "tinny", "goon", "no worries", "no wukkas", "no dramas", "she'll be right", "fair dinkum", "g'day",
  "deadset", "bloody oath", "too right", "ripper", "bonza", "sweet as", "flat out", "flat chat", "chockers", "dodgy",
  "cuppa", "smoko", "tradie", "Straya", "Aussie", "Kiwi", "pommy", "yeah nah", "nah yeah", "she's apples", "full on",
  "lollies", "bikkie", "rellies", "mozzie", "sunnies", "trackies", "durry", "my shout", "rock up", "rooted", "devo",
  "povo", "bogan", "daggy", "drongo", "galah", "dunny", "doona", "footy", "hard yakka", "chuck a sickie", "chuck a U-ey",
  "strewth", "crikey", "spewin'", "carked it", "stoked", "heaps", "keen", "reckon", "avo", "how ya going",
  // British
  "innit", "bruv", "knackered", "gutted", "chuffed", "skint", "quid", "fiver", "tenner", "gobsmacked", "taking the piss",
  "taking the mick", "cheeky", "peng", "wagwan", "mandem", "minging", "sorted", "can't be arsed", "Bob's your uncle", "fortnight",
  // American and online
  "no cap", "bet", "facts", "lowkey", "highkey", "slaps", "bussin'", "rizz", "sus", "mid", "tilted", "salty", "it's giving",
  "slay", "ghosted", "simp", "GOAT", "touch grass", "based", "delulu", "situationship", "drip", "bougie", "periodt", "on God",
  "finna", "y'all", "deadass", "bruh", "fam", "yeet", "chillin'", "chillin' like a villain", "kick it", "hella", "say less",
  "no shot", "caught in 4K", "built different", "rent free", "glow up", "vibe check",
  // Characters and names people mention
  "Pinocchio", "Geppetto", "Cinderella", "Rapunzel", "Elsa", "Olaf", "Moana", "Simba", "Mufasa", "Bluey", "Bingo",
  "Peppa Pig", "Paw Patrol", "SpongeBob", "Shrek", "Pikachu", "Pokémon", "Mario", "Luigi", "Sonic", "Minecraft", "Fortnite",
  "Roblox", "Spider-Man", "Batman", "Iron Man", "Hulk", "Harry Potter", "Hermione", "Gandalf", "Yoda", "Darth Vader",
  "Winnie the Pooh", "Tigger", "Scooby-Doo", "Mickey Mouse", "Snoopy", "Garfield", "Barbie", "Buzz Lightyear", "Nemo", "Dory",
  // Sport (volleyball first)
  "libero", "setter", "spike", "dig", "ace", "rotation", "block", "pancake", "timeout", "side out",
];

const TURKISH: string[] = [
  // Everyday spoken words and particles
  "kanka", "kanki", "valla", "vallahi", "eyvallah", "inşallah", "maşallah", "hocam", "abi", "abla", "aynen", "naber", "boşver",
  "napıyorsun", "napıyosun", "noldu", "nolur", "bi şey", "bi daha", "bi dakika", "değil mi", "di mi", "yani", "hani", "işte", "şey",
  "hadi ya", "yok ya", "of ya", "ay", "aman", "tamam", "olur", "bence", "galiba", "herhalde", "keşke", "resmen", "cidden", "harbiden",
  "geliyorum", "gelicem", "gidiyorum", "gidicem", "yapıyorum", "yapıcam", "diyorum", "dicem", "arıycam", "bakıcam", "görüşürüz",
  "kolay gelsin", "eline sağlık", "elinize sağlık", "geçmiş olsun", "afiyet olsun", "hayırlı olsun", "nazar değmesin", "Allah Allah",
  "kafana takma", "boş yapma", "saçmalama", "abartma", "şaka maka", "kusura bakma", "sağ ol", "teşekkür ederim", "rica ederim",
  // Affection and family
  "canım", "aşkım", "hayatım", "bebeğim", "tatlım", "birtanem", "özledim", "seni seviyorum", "anne", "baba", "annem", "babam",
  "teyze", "hala", "dayı", "amca", "yenge", "enişte", "kuzen", "anneanne", "babaanne", "dede", "kardeşim", "teyzecim", "ablacım",
  // Food and drink
  "mantı", "börek", "dolma", "sarma", "menemen", "simit", "lahmacun", "künefe", "baklava", "ayran", "rakı", "çay", "kahvaltı",
  "köfte", "döner", "pide", "çorba", "mercimek", "kumpir", "gözleme", "poğaça", "lokum",
  // Places
  "İstanbul", "Ankara", "İzmir", "Antalya", "Bodrum", "Bursa", "Kadıköy", "Beşiktaş", "Üsküdar", "Taksim", "Şişli", "Bakırköy",
  "Kapadokya", "Fethiye", "Marmaris", "Çeşme", "Alaçatı", "Trabzon", "Eskişehir", "Adana", "Gaziantep", "Kayseri", "Konya",
  // Names people mention
  "Ayşe", "Fatma", "Elif", "Zeynep", "Merve", "Büşra", "Esra", "Ezgi", "Selin", "Deniz", "Mehmet", "Ahmet", "Mustafa", "Emre",
  "Burak", "Murat", "Can", "Cem", "Kerem", "Yusuf", "Ömer", "Alperen", "Muammer", "Hakan", "Serkan", "Oğuz", "Tolga",
  // Sport
  "libero", "smaç", "manşet", "pasör", "Galatasaray", "Fenerbahçe", "Beşiktaş", "Trabzonspor", "derbi",
];
const SPANISH: string[] = ["güey", "neta", "vale", "chévere", "bacán", "pana", "libero", "remate"];
const PORTUGUESE: string[] = ["mano", "beleza", "valeu", "tipo", "gambiarra", "líbero", "levantador"];
const RUSSIAN: string[] = ["короче", "блин", "прикол", "кайф", "норм", "либеро", "связующий"];

const BY_LANG: Record<string, string[]> = { en: ENGLISH, tr: TURKISH, es: SPANISH, pt: PORTUGUESE, ru: RUSSIAN };

/**
 * Approved additions, grown from "Not right?" reports without a redeploy (scripts/review-reports.ts):
 * /data/vocab-extra.json = { terms: { en: [...], tr: [...] }, slang: { en: ["phrase = meaning", ...] } }.
 * Re-read at most once a minute when the file changes.
 */
export type VocabExtra = { terms?: Record<string, string[]>; slang?: Record<string, string[]> };
let extra: VocabExtra = {};
let extraMtime = 0;
let extraCheckedAt = 0;
export function vocabExtra(): VocabExtra {
  const now = Date.now();
  if (now - extraCheckedAt < 60_000) return extra;
  extraCheckedAt = now;
  try {
    const f = dataFile("vocab-extra.json");
    if (!existsSync(f)) return extra;
    const m = statSync(f).mtimeMs;
    if (m !== extraMtime) {
      extra = JSON.parse(readFileSync(f, "utf8")) as VocabExtra;
      extraMtime = m;
    }
  } catch {
    // A bad file never breaks calls: keep the last good version.
  }
  return extra;
}

/** Soniox allows ~10,000 characters of context; terms beyond this budget are left out. */
const TERMS_BUDGET = 7000;

export function sonioxContext(source: string, names: string[]): SonioxContext {
  const people = [...new Set(names.map((n) => n.trim()).filter((n) => n && !/^[A-Z]$/.test(n)))].slice(0, 12);
  const lang = baseLang(source) ?? "";
  // A term that sounds like someone in the call loses to their name: "Esky" (a cooler box)
  // would otherwise pull an Australian saying "Ezgi" towards the wrong word.
  const nameWords = people.flatMap((n) => n.split(/\s+/));
  const listed = [...(BY_LANG[lang] ?? []), ...(vocabExtra().terms?.[lang] ?? [])].filter(
    (t) => !nameWords.some((n) => t.split(/\s+/).some((w) => soundsAlike(w, n) && w.toLowerCase() !== n.toLowerCase())),
  );
  const all = [...people, ...listed];
  const terms: string[] = [];
  let size = 0;
  for (const t of new Set(all)) {
    if (size + t.length + 3 > TERMS_BUDGET) break;
    terms.push(t);
    size += t.length + 3;
  }
  return {
    general: [
      { key: "setting", value: "casual video call between friends, family or teammates" },
      { key: "style", value: "everyday spoken language with slang" },
      ...(people.length ? [{ key: "people in the call", value: people.join(", ") }] : []),
    ],
    terms,
  };
}
