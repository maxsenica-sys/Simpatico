import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { log } from "./log";

/**
 * Tiny append-only store for the development phase: tester feedback, client errors and one
 * summary line per call. JSON lines on the Fly volume (/data), or ./data locally.
 * No audio, video or words of a conversation are ever written here.
 */
const DIR = process.env.DATA_DIR ?? (existsSync("/data") ? "/data" : join(process.cwd(), "data"));
const MAX_BYTES = 5 * 1024 * 1024; // rotate each file at 5 MB (one previous file kept)

export type Kind = "feedback" | "errors" | "calls" | "conn" | "reports";

function file(kind: Kind) {
  return join(DIR, `${kind}.jsonl`);
}

export function append(kind: Kind, record: Record<string, unknown>) {
  try {
    mkdirSync(DIR, { recursive: true });
    const f = file(kind);
    if (existsSync(f) && statSync(f).size > MAX_BYTES) renameSync(f, `${f}.1`);
    appendFileSync(f, JSON.stringify({ ts: new Date().toISOString(), ...record }) + "\n");
  } catch (err) {
    log("store_write_failed", { kind, error: String(err) });
  }
}

/** Newest first. */
export function recent(kind: Kind, limit = 200): Record<string, unknown>[] {
  try {
    const f = file(kind);
    if (!existsSync(f)) return [];
    return readFileSync(f, "utf8")
      .trim()
      .split("\n")
      .slice(-limit)
      .reverse()
      .flatMap((l) => {
        try {
          return [JSON.parse(l) as Record<string, unknown>];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

/** Short device description from a user agent, without keeping the full string. */
export function device(ua: string | undefined): string {
  if (!ua) return "?";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "other";
  const br = /CriOS|Chrome\//.test(ua) && !/Edg\//.test(ua) ? "Chrome" : /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "other";
  const app = /SimpaticoApp\//.test(ua) ? " (Simpatico app)" : /Instagram|FBAN|FBAV|WhatsApp|Line\//.test(ua) ? " (in-app)" : "";
  return `${os} ${br}${app}`;
}
