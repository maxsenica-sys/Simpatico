import { randomBytes } from "node:crypto";
import { createReadStream, createWriteStream, mkdirSync, rmSync, statSync, unlinkSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { log } from "./log";

/**
 * Photos and videos sent in a call's messages. Kept only while the call is on: on the machine's
 * scratch disk (wiped on every restart, never the data volume), deleted the moment the room
 * closes. Nobody but the people in the call gets the link, and the id in it is random.
 */
const DIR = process.env.MEDIA_DIR ?? join(tmpdir(), "simpatico-media");
export const MEDIA_LIMITS = {
  image: 15 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  /** Everything in one call. */
  room: 400 * 1024 * 1024,
  /** Everything on this machine. */
  total: 3 * 1024 * 1024 * 1024,
};
const TYPES: Record<string, "image" | "video"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/gif": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/quicktime": "video",
  "video/webm": "video",
};

export type MediaItem = { id: string; from: string; kind: "image" | "video"; mime: string; size: number; path: string; at: number };
const byRoom = new Map<string, Map<string, MediaItem>>();
let totalBytes = 0;

// Anything left from before a restart belongs to calls that no longer exist.
try {
  rmSync(DIR, { recursive: true, force: true });
} catch {}

export function mediaKind(mime: string): "image" | "video" | null {
  return TYPES[mime.split(";")[0].trim().toLowerCase()] ?? null;
}

/** Stream an upload to disk, enforcing the size limits. Resolves with the item, or an error code. */
export function saveUpload(req: IncomingMessage, room: string, from: string): Promise<MediaItem | "bad-type" | "too-big" | "full" | "failed"> {
  const mime = String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  const kind = mediaKind(mime);
  if (!kind) return Promise.resolve("bad-type");
  const limit = MEDIA_LIMITS[kind];
  const declared = Number(req.headers["content-length"] ?? 0);
  if (declared > limit) return Promise.resolve("too-big");
  const items = byRoom.get(room) ?? new Map<string, MediaItem>();
  const roomBytes = [...items.values()].reduce((n, x) => n + x.size, 0);
  if (roomBytes + declared > MEDIA_LIMITS.room || totalBytes + declared > MEDIA_LIMITS.total) return Promise.resolve("full");

  const id = randomBytes(16).toString("hex");
  const dir = join(DIR, room);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, id);
  const out = createWriteStream(path);
  let size = 0;
  return new Promise((resolve) => {
    let done = false;
    const fail = (why: "too-big" | "failed") => {
      if (done) return;
      done = true;
      req.unpipe(out);
      out.destroy();
      try {
        unlinkSync(path);
      } catch {}
      resolve(why);
    };
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) fail("too-big");
    });
    req.on("aborted", () => fail("failed"));
    req.on("error", () => fail("failed"));
    out.on("error", () => fail("failed"));
    out.on("finish", () => {
      if (done) return;
      done = true;
      if (size === 0) {
        try {
          unlinkSync(path);
        } catch {}
        return resolve("failed");
      }
      const item: MediaItem = { id, from, kind, mime, size, path, at: Date.now() };
      items.set(id, item);
      byRoom.set(room, items);
      totalBytes += size;
      log("media_sent", { room, kind, kb: Math.round(size / 1024) });
      resolve(item);
    });
    req.pipe(out);
  });
}

/** Serve a photo or video to someone in the call, with byte ranges (Safari needs them for video). */
export function serveMedia(req: IncomingMessage, res: ServerResponse, room: string, id: string) {
  const item = byRoom.get(room)?.get(id);
  if (!item) {
    res.writeHead(404, { "Cache-Control": "no-store" });
    return res.end();
  }
  let size = item.size;
  try {
    size = statSync(item.path).size;
  } catch {
    res.writeHead(404);
    return res.end();
  }
  const headers: Record<string, string | number> = {
    "Content-Type": item.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename="simpatico-${item.kind}-${item.id.slice(0, 6)}.${ext(item.mime)}"`,
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ""));
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) {
      res.writeHead(416, { "Content-Range": `bytes */${size}` });
      return res.end();
    }
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
    if (req.method === "HEAD") return res.end();
    return void createReadStream(item.path, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, "Content-Length": size });
  if (req.method === "HEAD") return res.end();
  createReadStream(item.path).pipe(res);
}

function ext(mime: string) {
  return { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" }[mime] ?? "bin";
}

/** The call is over: its photos and videos go with it. */
export function dropRoomMedia(room: string) {
  const items = byRoom.get(room);
  if (!items) return;
  for (const x of items.values()) totalBytes -= x.size;
  byRoom.delete(room);
  try {
    rmSync(join(DIR, room), { recursive: true, force: true });
  } catch {}
  log("media_deleted", { room, items: items.size });
}

export const newMediaKey = () => randomBytes(16).toString("hex");
