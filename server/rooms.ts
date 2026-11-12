import { randomInt } from "node:crypto";
import type { WebSocket } from "ws";
import { baseLang, type ParticipantLang } from "../shared/lang";
import type { CaptionStyle, Gender, PeerInfo, RoomKind, ServerMsg, SpeakerProfile, Topic } from "../shared/protocol";
import { log } from "./log";
import { SpeakerPipeline, type ReaderMsg } from "./pipeline";
import { append } from "./store";
import type { ContextLine } from "./refine";

/** A call has no time limit while anyone is in it. A link nobody has used yet lasts a day. */
export const UNUSED_TTL_MS = 24 * 60 * 60 * 1000;
/** Everyone gone: the link keeps working this long, so a dropped call can be rejoined. */
export const EMPTY_TTL_MS = 5 * 60 * 1000;
/**
 * A dropped connection keeps its seat (and its WebRTC calls, which may still be up) for this
 * long: phones switching between Wi-Fi and mobile data, lifts and tunnels, a quick app switch.
 */
export const SEAT_GRACE_MS = 90 * 1000;
/** Settled caption lines kept in memory per room, for "Not right?" reports. */
const RECENT_LINES = 200;
/**
 * Group calls are a full mesh: every phone connects to every other phone. That is fine for
 * audio and for video from the active speaker only, up to about a dozen people; beyond that the
 * transport should move to an SFU (see README). Override with GROUP_MAX.
 */
export const GROUP_MAX = Math.max(2, Number(process.env.GROUP_MAX ?? 12));
const CONTEXT_LINES = 6;
const MAX_ROOMS = 2000;
const LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Floor control for people in the same physical room: every phone there hears whoever is
// talking, so only the phone that hears them loudest (their own) is captioned.
const FLOOR_HOLD_MS = 600; // floor stays with its holder this long after their last chunk
const FLOOR_STEAL_DB = 8; // someone else must be this much louder to take it over
const FLOOR_ECHO_MS = 2000; // after release, a much quieter claimant is the same voice heard from afar
const FLOOR_ECHO_DB = 12;

export type Peer = {
  id: string;
  label: string;
  name: string;
  lang: ParticipantLang;
  inRoom: boolean;
  ws: WebSocket | null;
  graceTimer: NodeJS.Timeout | null;
  /** One caption pipeline per language this person's speech must be translated into. */
  pipelines: Map<string, SpeakerPipeline>;
  /** The pipeline that also sends the speaker their own words and records context. */
  primaryKey: string | null;
  /** We've told everyone this person is speaking (their audio is being captioned). */
  speaking: boolean;
  /** How this person reads captions of others. */
  captionStyle: CaptionStyle;
  /** Optional, for grammatical gender in translations. */
  gender?: Gender;
  /** Optional "Me" profile from their phone (memory only, gone with the room). */
  profile: SpeakerProfile;
};

export type Room = {
  code: string;
  kind: RoomKind;
  max: number;
  createdAt: number;
  peers: Map<string, Peer>;
  history: ContextLine[];
  /**
   * The latest settled captions (what was said, how it was translated), in memory only, so a
   * reader can report a bad translation. Never written anywhere unless someone reports a line.
   */
  recent: Map<string, { from: string; source: string; translation: string; srcLang: string; tgtLang: string }>;
  /** Per-room glossary (nicknames, in-jokes, places) injected into pass 2. Empty in V1. */
  glossary: Record<string, string>;
  /** Set when the last connected socket leaves, after someone has joined. */
  emptySince: number | null;
  floor: { peerId: string; level: number; at: number } | null;
  lastFloor: { level: number; at: number } | null;
  /** For the development dashboard: one summary line per call, written when the room closes. */
  stats: { startedAt: number | null; peak: number; people: Set<string>; langs: Set<string>; captionSeconds: number; devices: Set<string> };
};

const rooms = new Map<string, Room>();
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function send(ws: WebSocket | null | undefined, msg: ServerMsg) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

export function info(p: Peer): PeerInfo {
  return { id: p.id, name: p.name, lang: p.lang, inRoom: p.inRoom };
}

export function createRoom(kind: RoomKind = "pair", fixedCode?: string): Room | null {
  if (rooms.size >= MAX_ROOMS) return null;
  let code: string;
  if (fixedCode) code = fixedCode;
  else
    do code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    while (rooms.has(code));
  const room: Room = {
    code,
    kind,
    max: kind === "group" ? GROUP_MAX : 2,
    createdAt: Date.now(),
    peers: new Map(),
    history: [],
    glossary: {},
    recent: new Map(),
    emptySince: null,
    floor: null,
    lastFloor: null,
    stats: { startedAt: null, peak: 0, people: new Set(), langs: new Set(), captionSeconds: 0, devices: new Set() },
  };
  rooms.set(code, room);
  log("room_created", { room: code, kind });
  return room;
}

/**
 * Personal call links: a 10-character code made once on someone's phone ("My call link").
 * Its room is opened whenever someone visits it and closes when empty like any other, so the
 * same link works for every call with that person. 36^10 codes: not guessable.
 */
export const PERSONAL_CODE = /^[a-z0-9]{10}$/;

export function ensureRoom(code: string): Room | undefined {
  const c = code.toLowerCase();
  return getRoom(c) ?? (PERSONAL_CODE.test(c) ? (createRoom("pair", c) ?? undefined) : undefined);
}

export function getRoom(code: string): Room | undefined {
  const room = rooms.get(code.toLowerCase());
  if (room && expired(room)) {
    destroyRoom(room, "expired");
    return undefined;
  }
  return room;
}

export function others(room: Room, peer: Peer): Peer[] {
  return [...room.peers.values()].filter((p) => p !== peer);
}

export function broadcast(room: Room, msg: ServerMsg, except?: Peer) {
  for (const p of room.peers.values()) if (p !== except) send(p.ws, msg);
}

function expired(room: Room) {
  const now = Date.now();
  if (room.peers.size === 0 && room.emptySince === null) return now - room.createdAt > UNUSED_TTL_MS;
  return room.emptySince !== null && now - room.emptySince > EMPTY_TTL_MS;
}

const TOPICS: Topic[] = ["sport", "family", "work", "school", "travel", "food", "gaming", "music", "health", "faith"];

/** Only short, plain values get through: it goes into prompts and speech-recognition context. */
export function cleanProfile(raw: unknown): SpeakerProfile {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const from = typeof r.from === "string" && /^[A-Z]{2}$/.test(r.from) ? r.from : undefined;
  const words = Array.isArray(r.words)
    ? [...new Set(r.words.filter((w): w is string => typeof w === "string").map((w) => w.replace(/[\u0000-\u001f<>"]/g, "").trim().slice(0, 40)).filter(Boolean))].slice(0, 30)
    : [];
  const topics = Array.isArray(r.topics) ? (r.topics.filter((t) => TOPICS.includes(t as Topic)) as Topic[]).slice(0, 10) : [];
  return { from, words: words.length ? words : undefined, topics: topics.length ? topics : undefined };
}

function cleanName(name: unknown, label: string): string {
  const n = typeof name === "string" ? name.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40) : "";
  return n || `Guest ${label}`;
}

/** Join or rejoin. Returns the peer and whether it is new to the room, or an error code. */
export function seat(
  room: Room,
  peerId: string,
  lang: ParticipantLang,
  ws: WebSocket,
  opts: { name?: string; inRoom?: boolean; device?: string; captionStyle?: unknown; gender?: unknown; profile?: unknown } = {},
): { peer: Peer; fresh: boolean } | "room-full" {
  let peer = room.peers.get(peerId);
  let fresh = false;
  if (!peer) {
    if (room.peers.size >= room.max) {
      // A seat whose socket is gone can be taken over (same person, different browser).
      const stale = [...room.peers.values()].find((p) => !p.ws);
      if (!stale) return "room-full";
      removePeer(room, stale, "replaced");
    }
    const used = new Set([...room.peers.values()].map((p) => p.label));
    const label = [...LABELS].find((l) => !used.has(l)) ?? `P${room.peers.size + 1}`;
    peer = { id: peerId, label, name: "", lang, inRoom: false, ws: null, graceTimer: null, pipelines: new Map(), primaryKey: null, speaking: false, captionStyle: "instant", profile: {} };
    room.peers.set(peerId, peer);
    fresh = true;
  }
  if (peer.ws && peer.ws !== ws) peer.ws.close(4000, "replaced");
  if (peer.graceTimer) clearTimeout(peer.graceTimer);
  peer.graceTimer = null;
  peer.ws = ws;
  peer.lang = lang;
  peer.name = cleanName(opts.name, peer.label);
  peer.inRoom = room.kind === "group" && !!opts.inRoom;
  peer.captionStyle = opts.captionStyle === "steady" ? "steady" : "instant";
  peer.gender = opts.gender === "m" || opts.gender === "f" ? opts.gender : undefined;
  peer.profile = cleanProfile(opts.profile);
  room.emptySince = null;
  const connected = [...room.peers.values()].filter((p) => p.ws).length;
  room.stats.people.add(peerId);
  room.stats.langs.add(baseLang(lang.speaks) ?? lang.speaks);
  if (opts.device) room.stats.devices.add(opts.device);
  room.stats.peak = Math.max(room.stats.peak, connected);
  if (connected >= 2) room.stats.startedAt ??= Date.now();
  updatePipelines(room);
  if (!fresh) broadcast(room, { t: "peer-info", peer: info(peer) }, peer);
  return { peer, fresh };
}

/**
 * A reader tapped "Not right?" on a caption: save that one line (what was said and its
 * translation) so translations can be improved. The only words of a call ever stored, and
 * only because someone asked.
 */
export function reportLine(room: Room, peer: Peer, id: unknown) {
  if (typeof id !== "string") return;
  const line = room.recent.get(id);
  if (!line || line.from === peer.id) return;
  append("reports", { source: line.source, translation: line.translation, from: line.srcLang, to: line.tgtLang, readerReads: peer.lang.reads, kind: room.kind });
  log("translation_reported", { room: room.code, from: line.srcLang, to: line.tgtLang });
}

/** Type to talk: at most one message a second, 300 characters, plain text. */
const lastTyped = new WeakMap<Peer, number>();
export function typedText(room: Room, peer: Peer, raw: unknown) {
  if (typeof raw !== "string") return;
  const text = raw.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 300);
  const now = Date.now();
  if (!text || now - (lastTyped.get(peer) ?? 0) < 1000) return;
  lastTyped.set(peer, now);
  for (const [key, pl] of peer.pipelines) pl.typed(text, key === peer.primaryKey);
  log("typed_message", { room: room.code, peer: peer.label, chars: text.length });
}

export function setCaptionStyle(peer: Peer, style: unknown) {
  peer.captionStyle = style === "steady" ? "steady" : "instant";
}

/** Does this reader get this caption message? Each reading style gets only its own version. */
function forReader(msg: ReaderMsg, r: Peer): boolean {
  if (msg.t !== "caption" || !msg.style || msg.style === "all") return true;
  return msg.style === r.captionStyle;
}

function toClient(msg: ReaderMsg, from: string): ServerMsg {
  if (msg.t === "caption") {
    const { style: _style, cover: _cover, ...rest } = msg;
    return { ...rest, from };
  }
  return { ...msg, from };
}

export function setInRoom(room: Room, peer: Peer, inRoom: boolean) {
  peer.inRoom = room.kind === "group" && inRoom;
  broadcast(room, { t: "peer-info", peer: info(peer) }, peer);
}

/** Socket dropped: stop billing immediately, keep the seat briefly. */
export function disconnect(room: Room, peer: Peer, ws: WebSocket) {
  if (peer.ws !== ws) return; // already replaced by a newer socket
  peer.ws = null;
  stopSpeaking(room, peer);
  updatePipelines(room);
  if ([...room.peers.values()].every((p) => !p.ws)) room.emptySince = Date.now();
  peer.graceTimer = setTimeout(() => removePeer(room, peer, "timeout"), SEAT_GRACE_MS);
}

export function removePeer(room: Room, peer: Peer, why: string) {
  if (room.peers.get(peer.id) !== peer) return;
  if (peer.graceTimer) clearTimeout(peer.graceTimer);
  for (const pl of peer.pipelines.values()) pl.stop();
  peer.pipelines.clear();
  room.peers.delete(peer.id);
  if (room.floor?.peerId === peer.id) room.floor = null;
  const ws = peer.ws;
  peer.ws = null;
  if (ws) ws.close(1000, why);
  log("peer_left", { room: room.code, peer: peer.label, why, remaining: room.peers.size });
  broadcast(room, { t: "peer-left", peerId: peer.id });
  updatePipelines(room);
  if ([...room.peers.values()].every((p) => !p.ws)) room.emptySince ??= Date.now();
  // A personal link's room reopens whenever someone visits it, so close it the moment the
  // last person has left for good.
  if (room.peers.size === 0 && PERSONAL_CODE.test(room.code)) destroyRoom(room, "empty");
}

/**
 * Each speaker gets one Soniox pipeline per language somebody else in the call reads
 * (source = their own speaks, target = that reads), and only while someone reads it.
 * People who read the speaker's own language get the original words: from the primary
 * pipeline when there are translations, else from a transcription-only pipeline ("same").
 */
export function updatePipelines(room: Room) {
  for (const p of room.peers.values()) {
    if (!p.ws) {
      for (const pl of p.pipelines.values()) pl.stop();
      p.pipelines.clear();
      p.primaryKey = null;
      continue;
    }
    const speaks = baseLang(p.lang.speaks);
    const listeners = others(room, p).filter((o) => o.ws);
    const counts = new Map<string, number>();
    let sameReaders = 0;
    for (const o of listeners) {
      const r = baseLang(o.lang.reads);
      if (!r) continue;
      if (r === speaks) sameReaders++;
      else counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    // Most-read language first: it becomes the primary pipeline.
    const targets = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
    const wanted = targets.length ? targets : sameReaders ? ["same"] : [];

    for (const [key, pl] of p.pipelines) {
      if (!wanted.includes(key)) {
        pl.stop();
        p.pipelines.delete(key);
      }
    }
    p.primaryKey = wanted[0] ?? null;
    for (const key of wanted) {
      let pl = p.pipelines.get(key);
      if (!pl) {
        pl = makePipeline(room, p, key);
        p.pipelines.set(key, pl);
      }
      pl.setLanguages(p.lang.speaks, key === "same" ? p.lang.speaks : key);
    }
  }
}

function readersOf(room: Room, speaker: Peer, key: string): Peer[] {
  const speaks = baseLang(speaker.lang.speaks);
  return others(room, speaker).filter((o) => {
    if (!o.ws) return false;
    const r = baseLang(o.lang.reads);
    return key === "same" ? r === speaks : r === key;
  });
}

function makePipeline(room: Room, p: Peer, key: string): SpeakerPipeline {
  const isPrimary = () => p.primaryKey === key;
  return new SpeakerPipeline({
    ref: `${room.code}-${p.label}-${key}`,
    label: p.label,
    toReader: (msg) => {
      for (const r of readersOf(room, p, key)) if (forReader(msg, r)) send(r.ws, toClient(msg, p.id));
    },
    toSpeaker: (msg) => {
      if (isPrimary()) send(p.ws, msg);
    },
    toOriginal: (msg) => {
      if (!isPrimary() || key === "same") return;
      for (const r of readersOf(room, p, "same")) send(r.ws, toClient(msg, p.id));
    },
    context: () => room.history.slice(-CONTEXT_LINES),
    record: (line) => {
      if (!isPrimary()) return;
      room.history.push(line);
      if (room.history.length > 50) room.history.splice(0, room.history.length - 50);
    },
    glossary: () => room.glossary,
    billed: (seconds) => {
      room.stats.captionSeconds += seconds;
    },
    // Everyone's names and their own words: any of them may come up in this person's speech.
    names: () => [...room.peers.values()].flatMap((x) => [x.name, ...(x.profile.words ?? [])]),
    profile: () => p.profile,
    callNames: () => [...room.peers.values()].map((x) => x.name),
    callWords: () => [...new Set([...room.peers.values()].flatMap((x) => x.profile.words ?? []))],
    speakerName: () => p.name,
    settled: (id, source, translation) => {
      room.recent.set(id, { from: p.id, source, translation, srcLang: p.lang.speaks, tgtLang: key === "same" ? p.lang.speaks : key });
      if (room.recent.size > RECENT_LINES) room.recent.delete(room.recent.keys().next().value!);
    },
    people: () => {
      const readers = readersOf(room, p, key);
      return { speaker: p.gender, listener: readers.length === 1 ? readers[0].gender : undefined };
    },
    styles: () => {
      const readers = readersOf(room, p, key);
      return { steady: readers.some((r) => r.captionStyle === "steady"), instant: readers.some((r) => r.captionStyle === "instant") };
    },
  });
}

/**
 * Should this chunk of `peer`'s microphone be captioned? Remote people: always. People in the
 * same room: only the current floor holder, i.e. the phone hearing the talker loudest.
 */
export function admitAudio(room: Room, peer: Peer, level: number, now = Date.now()): boolean {
  if (!peer.inRoom) return true;
  const f = room.floor;
  if (f && f.peerId === peer.id) {
    f.level = f.level * 0.8 + level * 0.2;
    f.at = now;
    return true;
  }
  if (f && now - f.at < FLOOR_HOLD_MS) {
    if (level <= f.level + FLOOR_STEAL_DB) return false;
    // Clearly louder: someone new is talking near their own phone.
    const prev = room.peers.get(f.peerId);
    if (prev) stopSpeaking(room, prev);
  } else if (!f && room.lastFloor && now - room.lastFloor.at < FLOOR_ECHO_MS && level < room.lastFloor.level - FLOOR_ECHO_DB) {
    return false; // the same voice that just finished, picked up from across the room
  }
  room.floor = { peerId: peer.id, level, at: now };
  return true;
}

/** Feed admitted audio to every pipeline of this speaker and tell everyone they're speaking. */
export function speakerAudio(room: Room, peer: Peer, level: number, pcm: Buffer) {
  if (!admitAudio(room, peer, level)) return;
  for (const pl of peer.pipelines.values()) pl.audio(pcm);
  if (!peer.speaking && peer.pipelines.size) {
    peer.speaking = true;
    broadcast(room, { t: "speaking", peer: peer.id, on: true });
  }
}

export function stopSpeaking(room: Room, peer: Peer) {
  for (const pl of peer.pipelines.values()) pl.speechEnded();
  if (room.floor?.peerId === peer.id) {
    room.lastFloor = { level: room.floor.level, at: Date.now() };
    room.floor = null;
  }
  if (peer.speaking) {
    peer.speaking = false;
    broadcast(room, { t: "speaking", peer: peer.id, on: false });
  }
}

function destroyRoom(room: Room, why: string) {
  for (const p of room.peers.values()) {
    for (const pl of p.pipelines.values()) pl.stop();
    if (p.graceTimer) clearTimeout(p.graceTimer);
    send(p.ws, { t: "error", code: "room-not-found" });
    p.ws?.close(1000, why);
  }
  rooms.delete(room.code);
  log("room_closed", { room: room.code, why, minutes: Math.round((Date.now() - room.createdAt) / 60000) });
  const st = room.stats;
  if (st.startedAt) {
    const end = room.emptySince ?? Date.now();
    const captionMinutes = st.captionSeconds / 60;
    append("calls", {
      room: room.code,
      kind: room.kind,
      minutes: Math.round(((end - st.startedAt) / 60000) * 10) / 10,
      people: st.people.size,
      peak: st.peak,
      langs: [...st.langs],
      devices: [...st.devices],
      captionMinutes: Math.round(captionMinutes * 10) / 10,
      // Soniox real-time translation is about $0.18 per stream-hour; Claude adds a few cents.
      estCostUsd: Math.round((captionMinutes / 60) * 0.18 * 1000) / 1000,
    });
  }
}

setInterval(() => {
  for (const room of rooms.values()) if (expired(room)) destroyRoom(room, "expired");
}, 10_000).unref();
