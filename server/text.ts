/** Lowercase, strip punctuation and collapse whitespace, for "is this a real change" comparisons. */
export function normalize(s: string): string {
  return s
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const A = Array.from(a);
  const B = Array.from(b);
  if (!A.length) return B.length;
  if (!B.length) return A.length;
  let prev = Array.from({ length: B.length + 1 }, (_, i) => i);
  for (let i = 1; i <= A.length; i++) {
    const cur = [i];
    for (let j = 1; j <= B.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[B.length];
}

/**
 * True when swapping `literal` for `refined` would be visible churn without a change in meaning:
 * only case/punctuation differences, or a couple of characters on a longer line.
 */
export function isTrivialEdit(literal: string, refined: string): boolean {
  const a = normalize(literal);
  const b = normalize(refined);
  if (a === b) return true;
  const d = levenshtein(a, b);
  const len = Math.max(Array.from(a).length, Array.from(b).length);
  return d <= 2 || d / len < 0.08;
}

/**
 * A new phrase of a subtitle that starts by repeating the end of what is already on screen
 * (the translator sometimes says the last few words again): drop the repeated start. Returns
 * the phrase unchanged when nothing repeats. Two or more repeated words always count; a single
 * word only when it is a longer one ("the prices | prices are going up"), so "very | very good"
 * and "no | no, wait" are left alone.
 */
export function dropRepeat(shown: string, next: string): string {
  const words = (t: string) => t.split(/\s+/).filter(Boolean);
  const key = (w: string) => normalize(w);
  const a = words(shown).map(key).filter(Boolean);
  const raw = words(next);
  const b = raw.map(key);
  for (let k = Math.min(a.length, b.filter(Boolean).length, 12); k >= 1; k--) {
    // The first k real words of `next` (skipping pure punctuation) against the last k of `shown`.
    const idx: number[] = [];
    for (let i = 0; i < b.length && idx.length < k; i++) if (b[i]) idx.push(i);
    if (idx.length < k) continue;
    // One short word only counts when it can't be meant twice ("and and", "at at", "then Then").
    if (k === 1 && Array.from(b[idx[0]]).length < 5 && !/^(and|or|but|so|then|to|at|in|on|of|for|with|the|a|an|that|because|when|if|i|i'm|it's|is|was)$/.test(b[idx[0]])) continue;
    if (idx.every((i, n) => b[i] === a[a.length - k + n])) {
      return raw
        .slice(idx[k - 1] + 1)
        .join(" ")
        .replace(/^[\s,;:.…-]+/u, "")
        .trim();
    }
  }
  // The same verb again with a pronoun for what was just named ("…ran into Mia" + "ran into her, so…").
  for (const k of [3, 2]) {
    const idx: number[] = [];
    for (let i = 0; i < b.length && idx.length < k + 1; i++) if (b[i]) idx.push(i);
    if (idx.length < k + 1 || a.length < k + 1) continue;
    const same = idx.slice(0, k).every((i, n) => b[i] === a[a.length - k - 1 + n]);
    if (same && /^(her|him|them|it|she|he|they)$/.test(b[idx[k]])) return raw.slice(idx[k] + 1).join(" ").replace(/^[\s,;:.…-]+/u, "").trim();
  }
  return next;
}
