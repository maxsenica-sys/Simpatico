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
