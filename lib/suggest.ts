"use client";
/**
 * After a call: names that came up in it ("Mia", "Kadıköy"), picked out on this phone from
 * the captions it already showed, so they can be saved to the profile and recognised next time.
 * Nothing is sent anywhere, and the captions aren't kept.
 */
const STOP = new Set(
  "i im ill ive id ok okay oh mr mrs ms dr tv mum mom dad monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december english turkish australian aussie god allah yes no hi hey".split(" "),
);
/** Scripts with no capital letters: no way to spot names, so only the "add a word" box shows. */
const CAPS = /\p{Lu}/u;

export function suggestNames(texts: string[], known: string[], max = 6): string[] {
  const knownLow = new Set(known.flatMap((k) => k.toLocaleLowerCase().split(/\s+/)));
  const mid = new Map<string, number>();
  const all = new Map<string, number>();
  const lowercaseSeen = new Set<string>();
  for (const text of texts) {
    for (const sentence of text.split(/[.!?…\n]+/u)) {
      const words = sentence.match(/\p{L}[\p{L}'’-]*/gu) ?? [];
      words.forEach((raw, i) => {
        const w = raw.split(/['’]/)[0].replace(/-+$/, "");
        if (w.length < 2) return;
        const low = w.toLocaleLowerCase();
        if (!CAPS.test(w[0])) {
          lowercaseSeen.add(low);
          return;
        }
        if (w === w.toLocaleUpperCase() && w.length > 1) return; // OK, TV, AFL
        if (STOP.has(low.replace(/['’]/g, "")) || knownLow.has(low)) return;
        all.set(w, (all.get(w) ?? 0) + 1);
        if (i > 0) mid.set(w, (mid.get(w) ?? 0) + 1);
      });
    }
  }
  return [...all.entries()]
    .filter(([w, n]) => !lowercaseSeen.has(w.toLocaleLowerCase()) && ((mid.get(w) ?? 0) >= 2 || ((mid.get(w) ?? 0) >= 1 && n >= 2)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
}
