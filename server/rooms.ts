import { randomInt } from "node:crypto";
import type { WebSocket } from "ws";
import type { ParticipantLang } from "../shared/lang";
import type { ServerMsg } from "../shared/protocol";
import { log } from "./log";
import { SpeakerPipeline } from "./pipeline";
import type { ContextLine } from "./refine";

export const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
export const EMPTY_TTL_MS = 60 * 1000;
/** A dropped socket keeps its seat (and its WebRTC call, which may still be up) for this long. */
export const SEAT_GRACE_MS = 15 * 1000;
const CONTEXT_LINES = 6;
const MAX_ROOMS = 2000;

export type Peer = {
  id: string;
  label: "A" | "B";
  lang: ParticipantLang;
  ws: WebSocket | null;
  graceTimer: NodeJS.Timeout | null;
  pipeline: SpeakerPipeline;
};

export type Room = {
  code: string;
  createdAt: number;
  peers: Map<string, Peer>;
  history: ContextLine[];
  /** Per-pair glossary (nicknames, in-jokes, places) injected into pass 2. Empty in V1. */
  glossary: Record<string, string>;
  /** Set when the last connected socket leaves, after someone has joined. */
  emptySince: number | null;
};

const rooms = new Map<string, Room>();
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function send(ws: WebSocket | null | undefined, msg: ServerMsg) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

export function createRoom(): Room | null {
  if (rooms.size >= MAX_ROOMS) return null;
  let code: string;
  do code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  while (rooms.has(code));
  const room: Room = { code, createdAt: Date.now(), peers: new Map(), history: [], glossary: {}, emptySince: null };
  rooms.set(code, room);
  log("room_created", { room: code });
  return room;
}

export function getRoom(code: string): Room | undefined {
  const room = rooms.get(code.toLowerCase());
  if (room && expired(room)) {
    destroyRoom(room, "expired");
    return undefined;
  }
  return room;
}

export function partnerOf(room: Room, peer: Peer): Peer | undefined {
  for (const p of room.peers.values()) if (p !== peer) return p;
}

function expired(room: Room) {
  const now = Date.now();
  return now - room.createdAt > ROOM_TTL_MS || (room.emptySince !== null && now - room.emptySince > EMPTY_TTL_MS);
}

/** Join or rejoin. Returns the peer and whether it is new to the room, or an error code. */
export function seat(room: Room, peerId: string, lang: ParticipantLang, ws: WebSocket): { peer: Peer; fresh: boolean } | "room-full" {
  let peer = room.peers.get(peerId);
  let fresh = false;
  if (!peer) {
    if (room.peers.size >= 2) {
      // A seat whose socket is gone can be taken over (same person, different browser).
      const stale = [...room.peers.values()].find((p) => !p.ws);
      if (!stale) return "room-full";
      removePeer(room, stale, "replaced");
    }
    const used = new Set([...room.peers.values()].map((p) => p.label));
    const label = used.has("A") ? "B" : "A";
    const created: Peer = { id: peerId, label, lang, ws: null, graceTimer: null, pipeline: null! };
    created.pipeline = new SpeakerPipeline({
      ref: `${room.code}-${label}`,
      label,
      toReader: (msg) => send(partnerOf(room, created)?.ws, msg),
      toSpeaker: (msg) => send(created.ws, msg),
      context: () => room.history.slice(-CONTEXT_LINES),
      record: (line) => {
        room.history.push(line);
        if (room.history.length > 50) room.history.splice(0, room.history.length - 50);
      },
      glossary: () => room.glossary,
    });
    room.peers.set(peerId, created);
    peer = created;
    fresh = true;
  }
  if (peer.ws && peer.ws !== ws) peer.ws.close(4000, "replaced");
  if (peer.graceTimer) clearTimeout(peer.graceTimer);
  peer.graceTimer = null;
  peer.ws = ws;
  peer.lang = lang;
  room.emptySince = null;
  updatePipelines(room);
  return { peer, fresh };
}

/** Socket dropped: stop billing immediately, keep the seat briefly. */
export function disconnect(room: Room, peer: Peer, ws: WebSocket) {
  if (peer.ws !== ws) return; // already replaced by a newer socket
  peer.ws = null;
  updatePipelines(room);
  if ([...room.peers.values()].every((p) => !p.ws)) room.emptySince = Date.now();
  peer.graceTimer = setTimeout(() => removePeer(room, peer, "timeout"), SEAT_GRACE_MS);
}

export function removePeer(room: Room, peer: Peer, why: string) {
  if (room.peers.get(peer.id) !== peer) return;
  if (peer.graceTimer) clearTimeout(peer.graceTimer);
  peer.pipeline.stop();
  room.peers.delete(peer.id);
  const ws = peer.ws;
  peer.ws = null;
  if (ws) ws.close(1000, why);
  log("peer_left", { room: room.code, peer: peer.label, why });
  send(partnerOf(room, peer)?.ws, { t: "peer-left" });
  updatePipelines(room);
  if ([...room.peers.values()].every((p) => !p.ws)) room.emptySince ??= Date.now();
}

/** Each speaker's stream is configured source = own speaks, target = partner's reads, and only while both are connected. */
export function updatePipelines(room: Room) {
  for (const p of room.peers.values()) {
    const other = partnerOf(room, p);
    if (!p.ws) p.pipeline.stop();
    else p.pipeline.setLanguages(p.lang.speaks, other?.ws ? other.lang.reads : null);
  }
}

function destroyRoom(room: Room, why: string) {
  for (const p of room.peers.values()) {
    p.pipeline.stop();
    if (p.graceTimer) clearTimeout(p.graceTimer);
    send(p.ws, { t: "error", code: "room-not-found" });
    p.ws?.close(1000, why);
  }
  rooms.delete(room.code);
  log("room_closed", { room: room.code, why, minutes: Math.round((Date.now() - room.createdAt) / 60000) });
}

setInterval(() => {
  for (const room of rooms.values()) if (expired(room)) destroyRoom(room, "expired");
}, 10_000).unref();
