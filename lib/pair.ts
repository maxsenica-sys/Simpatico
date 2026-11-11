"use client";
/**
 * "Call them again" without invitations: every two people who have been in a call together
 * share a private room of their own. Each phone has a random key (kept on the phone); during a
 * call the phones swap keys over the call's encrypted connection, and both work out the same
 * room code from the two keys. The server never sees the keys, only the room code when someone
 * opens it, and the code is only known to those two phones.
 */
const KEY = "talk.me";
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function myKey(): string {
  try {
    let k = localStorage.getItem(KEY);
    if (!k || !/^[a-f0-9]{32}$/.test(k)) {
      k = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(KEY, k);
    }
    return k;
  } catch {
    return "";
  }
}

export function validKey(x: unknown): x is string {
  return typeof x === "string" && /^[a-f0-9]{32}$/.test(x);
}

/** The same 10-character room code on both phones (order doesn't matter). */
export async function pairCode(a: string, b: string): Promise<string> {
  const [x, y] = [a, b].sort();
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`simpatico-pair|${x}|${y}`)));
  return Array.from(bytes.slice(0, 10), (n) => ALPHABET[n % ALPHABET.length]).join("");
}
