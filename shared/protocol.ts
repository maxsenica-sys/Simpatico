// Wire protocol between browser and server over the single /ws socket.
// Text frames are JSON messages below. Binary frames (client -> server only) are the sender's
// own microphone: byte 0 = the chunk's level (dBFS + 120, clamped 0..255), then 16 kHz mono PCM16LE.

import type { ParticipantLang } from "./lang";

/** "pair" = a 1:1 call (the default). "group" = up to `max` people, each with their own language. */
export type RoomKind = "pair" | "group";

export type PeerInfo = {
  id: string;
  /** Shown to others in group calls. Never empty: the server fills in a default. */
  name: string;
  lang: ParticipantLang;
  /** Physically in the same room as the other in-room people: their audio isn't played to each other. */
  inRoom: boolean;
};

/**
 * What each side of a connection tells the other every couple of seconds, so either can tell
 * when media isn't actually arriving (e.g. an iPhone camera that stopped in the background).
 */
export type PeerStatus = {
  /** I'm sending camera video to you right now. */
  cam: boolean;
  /** I want to receive video (false = I chose audio only). */
  wantVideo: boolean;
  /** Your video frames are arriving and decoding here (null = not measurable yet). */
  recvVideo: boolean | null;
  /** Your audio packets are arriving here. */
  recvAudio: boolean | null;
  /** I switched to another app: my phone has paused my camera and mic, and I can't hear you. */
  away?: boolean;
  /** I switched to another app but my microphone is still live: voice only until I'm back. */
  bg?: boolean;
  /** My phone hasn't let me use my microphone yet (I can still hear you and read captions). */
  noMic?: boolean;
};

export type SignalData =
  | { kind: "offer"; session: string; sdp: string }
  | { kind: "answer"; session: string; sdp: string }
  | { kind: "candidate"; session: string; candidate: RTCIceCandidateInit }
  | { kind: "restart-request" }
  | ({ kind: "status" } & PeerStatus);

export type ClientMsg =
  | { t: "join"; room: string; peerId: string; lang: ParticipantLang; name?: string; inRoom?: boolean; captionStyle?: CaptionStyle; gender?: Gender; profile?: SpeakerProfile }
  /** Ask one peer (or every peer) to send a fresh offer: our connection to them is gone. */
  | { t: "need-offer"; to?: string }
  | { t: "signal"; to: string; data: SignalData }
  | { t: "speech"; on: boolean }
  | { t: "set-in-room"; inRoom: boolean }
  | { t: "set-caption-style"; style: CaptionStyle }
  /** Type to talk: shown to the others as a caption, translated into their language. */
  | { t: "typed"; text: string }
  /** "Not right?" on a caption line: the server saves that one line to improve translations. */
  | { t: "report"; id: string }
  | { t: "log"; event: string; detail?: Record<string, unknown> }
  | { t: "leave" }
  /** App-level heartbeat: iOS can keep a dead socket "open" after the app was in the background. */
  | { t: "ping" };

/**
 * How a person likes to read captions. Both show settled phrases that are never rewritten.
 * "instant" (shown as "Live", the default) also draws a faint preview of the words being spoken
 * after them; "steady" shows the settled phrases only.
 */
export type CaptionStyle = "steady" | "instant";

/**
 * Optional: how translations should refer to this person, for languages that mark gender even
 * for "I" and "you" (Russian "я устал/устала", Portuguese "obrigado/obrigada", Arabic "أنتَ/أنتِ").
 */
export type Gender = "m" | "f";

export type Topic = "sport" | "family" | "work" | "school" | "travel" | "food" | "gaming" | "music" | "health" | "faith";

/**
 * Optional "Me" profile sent with a call (kept on the phone; the server holds it in memory for
 * the call only): where you're from (accent, slang), names and words you use, usual topics.
 */
export type SpeakerProfile = { from?: string; words?: string[]; topics?: Topic[] };

/** Stages of a caption line, in the order they can occur. */
export type CaptionStage =
  | "live" // pass 1, still changing (60% opacity)
  | "steady" // steady reading style: settled text that may still grow at the end, never rewritten
  | "final" // settled on the pass-1 text (no refinement, or refinement was trivial / late)
  | "refined"; // pass 2 replaced it (100% opacity)

export type CaptionState = "ok" | "paused" | "unavailable";

export type ServerMsg =
  | { t: "pong" }
  | { t: "joined"; selfId: string; fresh: boolean; kind: RoomKind; max: number; peers: PeerInfo[]; iceServers: RTCIceServer[]; mediaKey?: string }
  /** A photo or video someone sent into the call's messages (kept only while the call is on). */
  | { t: "media"; id: string; from: string; kind: "image" | "video"; mime: string; size: number }
  | { t: "peer-joined"; peer: PeerInfo; offer: boolean }
  | { t: "peer-left"; peerId: string }
  | { t: "peer-info"; peer: PeerInfo }
  | { t: "signal"; from: string; data: SignalData }
  /** A caption of what `from` said, in this reader's language. */
  /** `tail`: Live reading style only, a faint preview of the words after `text` (may still change). */
  | { t: "caption"; id: string; from: string; stage: CaptionStage; text: string; tail?: string }
  /** What this participant themself said (source language), for the transcript. */
  | { t: "own"; id: string; text: string; final: boolean }
  /** Caption service health: "theirs" = captions of `from` reaching me, "mine" = captions of my speech. */
  | { t: "captions"; state: CaptionState; side: "theirs" | "mine"; from?: string }
  /** Someone's speech is being captioned right now (sent to everyone, the speaker included). */
  | { t: "speaking"; peer: string; on: boolean }
  | { t: "error"; code: "room-not-found" | "room-full" | "bad-request" | "unavailable" };

/** In person (one phone, two people): the phone to the server. Audio goes as binary frames. */
export type InPersonClientMsg =
  | { t: "start"; mine: string; theirs: string | null; names?: string[]; words?: string[] }
  /** Their language, picked after starting (or corrected). */
  | { t: "theirs"; lang: string }
  /** My language, changed during the conversation. */
  | { t: "mine"; lang: string }
  | { t: "speech"; on: boolean }
  | { t: "end" };

/** In person: the server to the phone. `for`: whose half a caption goes on; `by`: who said it. */
export type InPersonServerMsg =
  | { t: "ready" }
  | { t: "lang"; theirs: string }
  | { t: "cap"; for: "me" | "them"; id: string; stage: CaptionStage; text: string; tail?: string }
  | { t: "own"; by: "me" | "them"; id: string; text: string; final: boolean }
  | { t: "status"; state: CaptionState }
  | { t: "error"; code: "bad-request" | "unavailable" };

/** The longest message you can type or paste into a call's chat (about what Instagram allows in a direct message). */
export const TYPED_MAX = 1000;
