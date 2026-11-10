import { baseLang } from "../shared/lang";

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

const TURKISH: string[] = ["kanka", "kanki", "valla", "eyvallah", "inşallah", "maşallah", "hocam", "abi", "abla", "aynen", "naber", "boşver", "libero", "smaç", "manşet", "pasör"];
const SPANISH: string[] = ["güey", "neta", "vale", "chévere", "bacán", "pana", "libero", "remate"];
const PORTUGUESE: string[] = ["mano", "beleza", "valeu", "tipo", "gambiarra", "líbero", "levantador"];
const RUSSIAN: string[] = ["короче", "блин", "прикол", "кайф", "норм", "либеро", "связующий"];

const BY_LANG: Record<string, string[]> = { en: ENGLISH, tr: TURKISH, es: SPANISH, pt: PORTUGUESE, ru: RUSSIAN };

export function sonioxContext(source: string, names: string[]): SonioxContext {
  const people = [...new Set(names.map((n) => n.trim()).filter((n) => n && !/^[A-Z]$/.test(n)))].slice(0, 12);
  const terms = [...people, ...(BY_LANG[baseLang(source) ?? ""] ?? [])];
  return {
    general: [
      { key: "setting", value: "casual video call between friends, family or teammates" },
      { key: "style", value: "everyday spoken language with slang" },
      ...(people.length ? [{ key: "people in the call", value: people.join(", ") }] : []),
    ],
    terms,
  };
}
