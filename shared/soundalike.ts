/**
 * A rough "sounds like" key for names across accents and spellings: an English speaker saying
 * the Turkish name "Ezgi" is often transcribed as "esky" (and the reverse). Both reduce to the
 * same key here. Deliberately loose: it only ever adds a hint or drops a competing
 * recognition term, it never rewrites what someone said.
 */
export function soundKey(word: string): string {
  let w = word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // ş→s, ç→c, ğ→g, ö→o, ü→u, é→e
    .replace(/ı/g, "i")
    .replace(/[^a-z]/g, "");
  w = w
    .replace(/ph/g, "f")
    .replace(/(ck|ch|q|c(?=[aou])|g)/g, "k")
    .replace(/c/g, "s")
    .replace(/[zx]/g, "s")
    .replace(/w/g, "v")
    .replace(/(sh|j)/g, "s")
    .replace(/[yi]+/g, "i")
    .replace(/[eaou]+$/g, (m) => (m.length ? "a" : m)) // final vowels blur
    .replace(/h/g, "")
    .replace(/(.)\1+/g, "$1"); // doubled letters
  return w;
}

/** Do two words plausibly sound the same (same key, or keys one letter apart for longer words)? */
export function soundsAlike(a: string, b: string): boolean {
  const x = soundKey(a);
  const y = soundKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (Math.min(x.length, y.length) < 4 || Math.abs(x.length - y.length) > 1) return false;
  // One substitution, insertion or deletion.
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (x.length > y.length) i++;
    else if (y.length > x.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (x.length - i) + (y.length - j) <= 1;
}
