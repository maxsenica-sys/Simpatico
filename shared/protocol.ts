// Wire protocol between browser and server over the single /ws socket.
// Text frames are JSON messages below; binary frames (client -> server only) are
// 16 kHz mono PCM16LE audio from the sender's own microphone.

import type { ParticipantLang } from "./lang";

export type SignalData =
  | { kind: "offer"; session: string; sdp: string }
  | { kind: "answer"; session: string; sdp: string }
  | { kind: "candidate"; session: string; candidate: RTCIceCandidateInit }
  | { kind: "restart-request" };

export type ClientMsg =
  | { t: "join"; room: string; peerId: string; lang: ParticipantLang }
  | { t: "need-offer" }
  | { t: "signal"; data: SignalData }
  | { t: "speech"; on: boolean }
  | { t: "log"; event: string; detail?: Record<string, unknown> }
  | { t: "leave" };

/** Stages of a caption line, in the order they can occur. */
export type CaptionStage =
  | "live" // pass 1, still changing (60% opacity)
  | "final" // settled on the pass-1 text (no refinement, or refinement was trivial / late)
  | "refined"; // pass 2 replaced it (100% opacity)

export type ServerMsg =
  | { t: "joined"; selfId: string; fresh: boolean; partner: ParticipantLang | null; iceServers: RTCIceServer[] }
  | { t: "peer-joined"; partner: ParticipantLang; offer: boolean }
  | { t: "peer-left" }
  | { t: "signal"; data: SignalData }
  /** A caption of what the other person said, in this reader's language. */
  | { t: "caption"; id: string; stage: CaptionStage; text: string }
  /** What this participant themself said (source language), for the transcript. */
  | { t: "own"; id: string; text: string; final: boolean }
  | { t: "captions"; state: "ok" | "paused" | "unavailable" }
  | { t: "error"; code: "room-not-found" | "room-full" | "bad-request" };
