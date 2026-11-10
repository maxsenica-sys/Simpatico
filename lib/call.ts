"use client";
import type { ParticipantLang } from "@/shared/lang";
import type { CaptionStage, CaptionState, CaptionStyle, Gender, ClientMsg, PeerInfo, PeerStatus, RoomKind, ServerMsg, SignalData } from "@/shared/protocol";
import { MicCapture } from "./audio";
import { ScreenAwake } from "./wakeLock";
import { getCameraTrack, getMicTrack, hasMultipleCameras, isMobileDevice } from "./media";

export type Phase =
  | "joining" // socket connecting / join in flight
  | "waiting" // alone in the room
  | "connecting" // others present, WebRTC negotiating with all of them
  | "connected" // connected to at least one person
  | "failed" // couldn't connect to anyone: show a plain error, never a black screen
  | "ended" // we hung up
  | "gone" // room expired / not found
  | "full"
  | "replaced";

export type Caption = { id: string; from: string; text: string; tail?: string; stage: CaptionStage; updatedAt: number; doneAt: number | null };
export type TranscriptLine = { id: string; who: "me" | "them"; from: string | null; text: string; final: boolean; at: number };

/** A problem one side can see about the call, shown as a banner with an action where one helps. */
export type Problem =
  | "they-cant-see-you" // my camera is on but my video isn't arriving at someone's end
  | "they-cant-hear-you" // my audio isn't arriving at someone's end
  | "camera-failed" // couldn't (re)start my camera
  | "weak-network"; // suggest audio only

export type Participant = PeerInfo & {
  stream: MediaStream | null;
  connected: boolean;
  failed: boolean;
  /** They say they're sending me camera video (null until they report). */
  remoteCam: boolean | null;
  /** Their video frames are actually arriving and decoding here. */
  videoOk: boolean;
  /** They chose audio only, so I'm not sending them video. */
  partnerAudioOnly: boolean;
  /** They switched to another app (their phone paused their camera and mic). */
  away: boolean;
  /** Their speech is being captioned right now. */
  speaking: boolean;
  captionStatus: CaptionState;
};

export type CallState = {
  phase: Phase;
  kind: RoomKind;
  max: number;
  /** Name of the last person to leave while we're now alone. */
  peerLeft: string | null;
  reconnecting: boolean;
  participants: Participant[];
  /** Who is on the main stage: the last person to speak. */
  activeId: string | null;
  captions: Caption[];
  transcript: TranscriptLine[];
  /** Worst caption health of anyone's speech reaching me. */
  captionStatus: CaptionState;
  /** Captions of my speech reaching the others. */
  myCaptionStatus: CaptionState;
  muted: boolean;
  /** My camera is on (it may still be paused for someone who chose audio only). */
  camOn: boolean;
  /** I chose audio only: no video sent or received. */
  audioOnly: boolean;
  /** I'm in the same room as the other in-room people (group calls): their audio isn't played here. */
  inRoom: boolean;
  canSwitchCamera: boolean;
  /** My voice is being picked up right now (the mic gate is open). */
  meSpeaking: boolean;
  /** My latest recognised words, so I can see captions of me are working. */
  ownLine: { text: string; at: number } | null;
  problems: Problem[];
  /** What my own self-view shows (a fresh stream whenever the camera track changes). */
  selfVideo: MediaStream | null;
  /** Everyone who has been in the call, by id (kept after they leave, for the transcript). */
  names: Record<string, string>;
  /** Most other people connected at once. */
  peak: number;
  /** When we first connected to someone, and when we hung up. */
  startedAt: number | null;
  endedAt: number | null;
};

const CONNECT_TIMEOUT_MS = 20_000;
/** After a drop, keep trying to bring a call back this long (ICE restart every RETRY_EVERY_MS). */
const RECONNECT_FOR_MS = 2 * 60_000;
/** Video steps when the phone's processor limits encoding: size divisor and frame rate. */
const CPU_STEPS = [
  { scale: 1, fps: 30 },
  { scale: 1.5, fps: 20 },
  { scale: 2, fps: 15 },
];

/**
 * Voice settings in the SDP: in-band forward error correction (recovers lost voice packets
 * instead of crackling) and DTX (near-silent packets during pauses: less radio, less battery).
 */
export function tuneOpus(sdp: string): string {
  const pt = sdp.match(/a=rtpmap:(\d+) opus\/48000/i)?.[1];
  if (!pt) return sdp;
  const want = ["useinbandfec=1", "usedtx=1"];
  const fmtp = new RegExp(`^a=fmtp:${pt} (.*)$`, "m");
  if (fmtp.test(sdp)) {
    return sdp.replace(fmtp, (line, params: string) => {
      const have = params.split(";").map((x) => x.trim().split("=")[0]);
      const add = want.filter((w) => !have.includes(w.split("=")[0]));
      return add.length ? `${line};${add.join(";")}` : line;
    });
  }
  return sdp.replace(new RegExp(`^(a=rtpmap:${pt} opus/48000.*)$`, "mi"), `$1\r\na=fmtp:${pt} ${want.join(";")}`);
}
const RETRY_EVERY_MS = 8_000;
const DISCONNECT_GRACE_MS = 4_000;
const STATUS_EVERY_MS = 2_000;
/** Consecutive bad reports (x 2 s) before we act on "they can't see / hear you". */
const BAD_REPORTS_TO_ACT = 3;
const WEAK_CHECKS_TO_WARN = 4;
/** Group calls above this size send video only from whoever spoke last (mesh bandwidth). */
const ALL_VIDEO_UP_TO = 4;

type MediaCounters = { framesDecoded: number; audioPackets: number; lost: number; received: number; framesSent: number };

/** One WebRTC connection to one other person. */
type Link = {
  id: string;
  pc: RTCPeerConnection | null;
  session: string;
  offerer: boolean;
  pending: RTCIceCandidateInit[];
  connectTimer: ReturnType<typeof setTimeout> | null;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
  videoSender: RTCRtpSender | null;
  audioSender: RTCRtpSender | null;
  remoteTracks: Map<string, MediaStreamTrack>;
  last: MediaCounters | null;
  noVideoReports: number;
  noAudioReports: number;
  localVideoBad: number;
  /** Has been connected at least once: a drop is retried quietly instead of reported as failed. */
  wasConnected: boolean;
  /** When the connection dropped, while it is down. */
  lostAt: number | null;
};

/**
 * Owns one call with any number of people: the signalling socket (which also carries our mic
 * audio and everyone's captions), one RTCPeerConnection per person, the mic tap, camera state
 * and the media health checks. UI subscribes to state snapshots.
 */
export class CallController {
  state: CallState;
  private listeners = new Set<() => void>();
  private ws: WebSocket | null = null;
  private wsRetry = 0;
  private wsTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private iceServers: RTCIceServer[] = [];
  private selfId = "";
  private links = new Map<string, Link>();
  /** Whoever spoke last, me included: in big groups only their video is sent. */
  private lastSpeaker: string | null = null;

  private mic: MicCapture | null = null;
  /** The screen stays on while in a call: people read captions without touching the phone. */
  private awake = new ScreenAwake();
  private facing: "user" | "environment" = "user";
  private cameraBusy = false;

  private statusTimer: ReturnType<typeof setInterval> | null = null;
  private weakChecks = 0;
  private goodChecks = 0;
  private degraded = false;
  /** Steps of video reduction because the phone's processor is struggling (heat, charging). */
  private cpuLevel = 0;
  private cpuChecks = 0;
  private cpuOkChecks = 0;
  private lastHeal = 0;
  private weakDismissedAt = 0;

  constructor(
    private room: string,
    private peerId: string,
    private lang: ParticipantLang,
    /** Our local stream. Its tracks change as the camera turns on/off or is recovered. */
    readonly local: MediaStream,
    private opts: { audioOnly?: boolean; name?: string; inRoom?: boolean; captionStyle?: CaptionStyle; voiceFocus?: boolean; gender?: Gender } = {},
  ) {
    const hasVideo = local.getVideoTracks().some((t) => t.readyState === "live");
    const audioOnly = !!opts.audioOnly;
    if (audioOnly) this.dropLocalVideo();
    this.state = {
      phase: "joining",
      kind: "pair",
      max: 2,
      peerLeft: null,
      reconnecting: false,
      participants: [],
      activeId: null,
      captions: [],
      transcript: [],
      captionStatus: "ok",
      myCaptionStatus: "ok",
      muted: false,
      camOn: hasVideo && !audioOnly,
      audioOnly,
      inRoom: !!opts.inRoom,
      canSwitchCamera: false,
      meSpeaking: false,
      ownLine: null,
      problems: [],
      selfVideo: null,
      names: {},
      peak: 0,
      startedAt: null,
      endedAt: null,
    };
    this.state.selfVideo = this.makeSelfStream();
    // Support aid: open the call with ?debug to inspect it from the browser console as window.__call.
    if (typeof location !== "undefined" && new URLSearchParams(location.search).has("debug")) (window as unknown as { __call: unknown }).__call = this;
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;
  private set(patch: Partial<CallState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }
  private setProblem(p: Problem, on: boolean) {
    const has = this.state.problems.includes(p);
    if (on && !has) this.set({ problems: [...this.state.problems, p] });
    if (!on && has) this.set({ problems: this.state.problems.filter((x) => x !== p) });
  }
  private participant(id: string) {
    return this.state.participants.find((p) => p.id === id);
  }
  private patchParticipant(id: string, patch: Partial<Participant>) {
    if (!this.participant(id)) return;
    this.set({ participants: this.state.participants.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  }

  // ------------------------------------------------------------ public API

  /** Must be called from the Join tap (user gesture) so iOS allows audio. */
  async start() {
    this.awake.on();
    window.addEventListener("online", this.onNetwork);
    (navigator as { connection?: EventTarget }).connection?.addEventListener?.("change", this.onNetwork);
    this.startMic(this.local.getAudioTracks()[0]);
    this.watchLocalTracks();
    document.addEventListener("visibilitychange", this.onVisible);
    this.connectSocket();
    hasMultipleCameras().then((m) => this.set({ canSwitchCamera: m }));
  }

  leave() {
    this.send({ t: "leave" });
    this.shutdown();
    this.releaseDevices();
    this.set({ phase: "ended", participants: [], selfVideo: null, endedAt: Date.now() });
  }

  /** Room code and my languages, for the end-of-call feedback. */
  get info() {
    return { room: this.room, lang: this.lang };
  }

  setMuted(muted: boolean) {
    for (const t of this.local.getAudioTracks()) t.enabled = !muted;
    if (this.mic) this.mic.enabled = !muted;
    this.set({ muted });
  }

  /** Reconnect to everyone we aren't connected to. */
  retry() {
    for (const p of this.state.participants) {
      if (p.connected) continue;
      this.closeLink(p.id);
      this.patchParticipant(p.id, { failed: false });
      this.send({ t: "need-offer", to: p.id });
      this.armConnectTimeout(this.ensureLink(p.id));
    }
    this.recomputePhase();
  }

  /** Turn my camera on or off. Captions and audio are unaffected. */
  async setCamera(on: boolean) {
    if (on) {
      if (this.state.audioOnly) this.set({ audioOnly: false });
      const ok = await this.ensureCamera();
      this.set({ camOn: ok });
      this.setProblem("camera-failed", !ok);
    } else {
      this.dropLocalVideo();
      this.set({ camOn: false });
      this.setProblem("camera-failed", false);
      this.setProblem("they-cant-see-you", false);
    }
    await this.applyAllVideo();
    this.sendAllStatus();
  }

  /** Audio only: stop my camera and ask the others to stop sending video. Captions keep working. */
  async setAudioOnly(on: boolean) {
    this.set({ audioOnly: on });
    this.setProblem("weak-network", false);
    if (on) {
      this.weakDismissedAt = Date.now();
      await this.setCamera(false);
      this.set({ audioOnly: true });
    } else {
      await this.setCamera(true);
    }
    this.sendAllStatus();
  }

  /** Same physical room as the other in-room people: don't play their audio here (they're audible anyway). */
  /** Steady (phrase by phrase, never rewritten) or instant (word by word) captions of others. */
  setCaptionStyle(style: CaptionStyle) {
    if (this.opts.captionStyle === style) return;
    this.opts.captionStyle = style;
    this.send({ t: "set-caption-style", style });
  }

  /** "Not right?" on a caption line: the server saves that line so translations can be improved. */
  report(id: string) {
    this.send({ t: "report", id });
  }

  /** Only caption the voice closest to this phone, not people talking further away. */
  setVoiceFocus(on: boolean) {
    this.opts.voiceFocus = on;
    if (this.mic) this.mic.focus = on;
  }

  setInRoom(on: boolean) {
    this.set({ inRoom: on });
    this.send({ t: "set-in-room", inRoom: on });
    this.updateMicRemote();
  }

  async switchCamera() {
    if (!this.state.camOn || this.cameraBusy) return;
    this.facing = this.facing === "user" ? "environment" : "user";
    // Stop the old one first: some phones can't open two cameras at once.
    this.dropLocalVideo();
    const ok = await this.ensureCamera();
    if (!ok) {
      this.facing = this.facing === "user" ? "environment" : "user";
      await this.ensureCamera();
    }
    await this.applyAllVideo();
  }

  dismissProblem(p: Problem) {
    if (p === "weak-network") this.weakDismissedAt = Date.now();
    this.setProblem(p, false);
  }

  /** Manual "fix video" from the banner: fresh camera track, then fresh connection paths. */
  async fixVideo() {
    this.lastHeal = 0;
    await this.heal("video", true);
  }

  /** Should this person's audio play here? Not if we're both in the same room. */
  audible(p: Participant) {
    return !(this.state.inRoom && p.inRoom);
  }

  dispose() {
    if (!this.stopped) this.shutdown();
    this.listeners.clear();
  }

  // --------------------------------------------------------- local media

  /** This page is in the background (another app, or the screen locked). */
  private hidden = false;

  private onVisible = () => {
    if (document.visibilityState !== "visible") {
      // Tell the others straight away: the phone is about to pause our camera and mic.
      if (!this.hidden) {
        this.hidden = true;
        this.sendAllStatus();
        this.log("away", {});
      }
      return;
    }
    if (this.hidden) {
      this.hidden = false;
      this.sendAllStatus();
      this.log("back", {});
    }
    this.mic?.resume();
    // iOS pauses or ends the camera and mic while Safari is in the background (e.g. switching to
    // WhatsApp to send the link). Bring them back as soon as we're visible again.
    setTimeout(() => this.recoverLocalTracks(), 800);
  };

  private shutdown() {
    this.stopped = true;
    this.awake.off();
    window.removeEventListener("online", this.onNetwork);
    (navigator as { connection?: EventTarget }).connection?.removeEventListener?.("change", this.onNetwork);
    document.removeEventListener("visibilitychange", this.onVisible);
    if (this.wsTimer) clearTimeout(this.wsTimer);
    for (const id of [...this.links.keys()]) this.closeLink(id);
    this.stopStatusLoop();
    this.mic?.stop();
    this.mic = null;
    this.ws?.close();
    this.ws = null;
  }

  /** Turn the camera light and mic off as soon as the call is over. */
  private releaseDevices() {
    for (const t of this.local.getTracks()) {
      t.onended = null;
      t.stop();
    }
  }

  private makeSelfStream(): MediaStream | null {
    const v = this.liveVideo();
    return v ? new MediaStream([v]) : null;
  }
  private refreshSelf() {
    this.set({ selfVideo: this.makeSelfStream() });
  }

  private startMic(track: MediaStreamTrack | undefined) {
    this.mic?.stop();
    this.mic = null;
    if (!track) return;
    this.mic = new MicCapture(
      track,
      (pcm, db) => this.sendAudio(pcm, db),
      (on) => {
        this.send({ t: "speech", on });
        this.set({ meSpeaking: on });
      },
    );
    this.mic.enabled = !this.state?.muted;
    this.mic.focus = this.opts.voiceFocus !== false;
    this.mic.start().catch((err) => this.log("mic_tap_failed", { error: String(err) }));
    this.updateMicRemote();
  }

  /** The mic gate ignores voices we're playing out loud; tell it which ones those are. */
  private updateMicRemote() {
    if (!this.mic) return;
    const tracks = this.state.participants
      .filter((p) => this.audible(p))
      .flatMap((p) => p.stream?.getAudioTracks() ?? []);
    this.mic.setRemote(tracks);
  }

  private watchLocalTracks() {
    for (const t of this.local.getTracks()) {
      t.onended = () => {
        this.log("local_track_ended", { kind: t.kind, visible: document.visibilityState });
        if (document.visibilityState === "visible") this.recoverLocalTracks();
      };
    }
  }

  private liveVideo(): MediaStreamTrack | null {
    return this.local.getVideoTracks().find((t) => t.readyState === "live") ?? null;
  }

  private dropLocalVideo() {
    for (const t of this.local.getVideoTracks()) {
      t.onended = null;
      t.stop();
      this.local.removeTrack(t);
    }
    if (this.state) this.refreshSelf();
  }

  /** Make sure there's a live camera track in `local`. Returns false if the camera can't start. */
  private async ensureCamera(): Promise<boolean> {
    const live = this.liveVideo();
    if (live && !live.muted) return true;
    if (this.cameraBusy) return !!live;
    this.cameraBusy = true;
    try {
      this.dropLocalVideo();
      const track = await getCameraTrack(this.facing);
      this.local.addTrack(track);
      this.watchLocalTracks();
      this.set({ camOn: true });
      this.refreshSelf();
      return true;
    } catch (err) {
      this.log("camera_start_failed", { error: String(err) });
      return false;
    } finally {
      this.cameraBusy = false;
    }
  }

  private async recoverLocalTracks() {
    if (this.stopped) return;
    const audio = this.local.getAudioTracks()[0];
    if (!audio || audio.readyState === "ended") {
      try {
        const track = await getMicTrack();
        if (audio) this.local.removeTrack(audio);
        this.local.addTrack(track);
        track.enabled = !this.state.muted;
        for (const l of this.links.values()) await l.audioSender?.replaceTrack(track);
        this.startMic(track);
        this.watchLocalTracks();
        this.log("mic_recovered");
      } catch (err) {
        this.log("mic_recover_failed", { error: String(err) });
      }
    }
    if (this.state.camOn) {
      const v = this.local.getVideoTracks()[0];
      if (!v || v.readyState === "ended" || v.muted) {
        const ok = await this.ensureCamera();
        this.setProblem("camera-failed", !ok);
        if (ok) this.log("camera_recovered");
        await this.applyAllVideo();
      }
    }
    this.sendAllStatus();
  }

  /** Small calls: everyone's video. Big groups: only whoever spoke last sends video (mesh bandwidth). */
  private mayShowVideo(): boolean {
    return this.state.kind === "pair" || this.state.participants.length < ALL_VIDEO_UP_TO || this.lastSpeaker === this.selfId;
  }

  /** I mean to be sending video to this person, whether or not it's working. */
  private sendingVideo(id: string): boolean {
    const p = this.participant(id);
    return this.state.camOn && !!p && !p.partnerAudioOnly && this.mayShowVideo();
  }

  /** What actually goes out on each video sender: my camera, unless off, paused, or not my turn. */
  private async applyVideoSender(link: Link) {
    if (!link.videoSender) return;
    const track = this.sendingVideo(link.id) ? this.liveVideo() : null;
    if (link.videoSender.track === track) return;
    try {
      await link.videoSender.replaceTrack(track);
    } catch (err) {
      this.log("replace_track_failed", { error: String(err) });
    }
  }
  private async applyAllVideo() {
    for (const l of this.links.values()) await this.applyVideoSender(l);
  }

  // ------------------------------------------------------------ signalling

  private connectSocket() {
    if (this.stopped) return;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.onopen = () => {
      this.wsRetry = 0;
      ws.send(
        JSON.stringify({
          t: "join",
          room: this.room,
          peerId: this.peerId,
          lang: this.lang,
          name: this.opts.name,
          captionStyle: this.opts.captionStyle,
          gender: this.opts.gender,
          inRoom: this.state.inRoom,
        } satisfies ClientMsg),
      );
    };
    ws.onmessage = (e) => {
      if (typeof e.data === "string") this.onServer(JSON.parse(e.data) as ServerMsg);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.stopped) return;
      if (e.code === 4000) {
        this.shutdown();
        this.set({ phase: "replaced", participants: [] });
        return;
      }
      // Signalling dropped; the WebRTC calls may well still be up. Reconnect quietly.
      this.set({ reconnecting: true });
      const delay = Math.min(5000, 500 * 2 ** this.wsRetry++);
      this.wsTimer = setTimeout(() => this.connectSocket(), delay);
    };
  }

  private send(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  /** Mic audio for captions, only while someone is there to read them. Byte 0 = level (dBFS + 120). */
  private sendAudio(pcm: ArrayBuffer, db: number) {
    if (!this.state.participants.length || this.ws?.readyState !== WebSocket.OPEN || this.ws.bufferedAmount > 64_000) return;
    const frame = new Uint8Array(pcm.byteLength + 1);
    frame[0] = Math.max(0, Math.min(255, Math.round(db + 120)));
    frame.set(new Uint8Array(pcm), 1);
    this.ws.send(frame);
  }

  private log(event: string, detail: Record<string, unknown> = {}) {
    this.send({ t: "log", event, detail });
  }

  private newParticipant(info: PeerInfo): Participant {
    return {
      ...info,
      stream: null,
      connected: false,
      failed: false,
      remoteCam: null,
      videoOk: false,
      partnerAudioOnly: false,
      away: false,
      speaking: false,
      captionStatus: "ok",
    };
  }

  private upsertParticipant(info: PeerInfo) {
    const existing = this.participant(info.id);
    if (existing) this.patchParticipant(info.id, { name: info.name, lang: info.lang, inRoom: info.inRoom });
    else this.set({ participants: [...this.state.participants, this.newParticipant(info)], peerLeft: null });
    this.set({ names: { ...this.state.names, [info.id]: info.name }, peak: Math.max(this.state.peak, this.state.participants.length) });
    if (!this.state.activeId) this.set({ activeId: info.id });
    this.updateMicRemote();
  }

  private removeParticipant(id: string) {
    const p = this.participant(id);
    this.closeLink(id);
    const participants = this.state.participants.filter((x) => x.id !== id);
    this.set({
      participants,
      captions: this.state.captions.filter((c) => c.from !== id),
      activeId: this.state.activeId === id ? (participants[0]?.id ?? null) : this.state.activeId,
      peerLeft: participants.length ? null : (p?.name ?? null),
    });
    if (!participants.length) {
      this.set({ problems: this.state.problems.filter((x) => x === "camera-failed") });
      this.stopStatusLoop();
    }
    this.updateMicRemote();
    this.recomputePhase();
    this.applyAllVideo();
  }

  private recomputePhase() {
    if (["ended", "gone", "full", "replaced"].includes(this.state.phase)) return;
    const ps = this.state.participants;
    const phase: Phase = !ps.length
      ? "waiting"
      : ps.some((p) => p.connected)
        ? "connected"
        : ps.every((p) => p.failed)
          ? "failed"
          : "connecting";
    if (phase !== this.state.phase) this.set({ phase, startedAt: phase === "connected" ? (this.state.startedAt ?? Date.now()) : this.state.startedAt });
  }

  private onServer(msg: ServerMsg) {
    switch (msg.t) {
      case "joined": {
        this.selfId = msg.selfId;
        this.iceServers = msg.iceServers;
        if (!msg.fresh && this.state.reconnecting) this.log("socket_back", { tries: this.wsRetry });
        this.set({ reconnecting: false, kind: msg.kind, max: msg.max });
        const present = new Set(msg.peers.map((p) => p.id));
        for (const p of this.state.participants) if (!present.has(p.id)) this.removeParticipant(p.id);
        for (const info of msg.peers) {
          this.upsertParticipant(info);
          const link = this.links.get(info.id);
          if (link?.pc && ["connected", "connecting", "new"].includes(link.pc.connectionState)) continue; // signalling blip only
          // A brand-new seat waits: the server has told everyone else to offer.
          // A returning seat asks each person to offer again.
          if (!msg.fresh) this.send({ t: "need-offer", to: info.id });
          this.armConnectTimeout(this.ensureLink(info.id));
        }
        this.recomputePhase();
        // Coming back from the background is when iOS cameras need reviving.
        this.recoverLocalTracks();
        break;
      }
      case "peer-joined":
        this.upsertParticipant(msg.peer);
        this.patchParticipant(msg.peer.id, { failed: false });
        if (msg.offer) this.makeOffer(msg.peer.id);
        this.recomputePhase();
        this.applyAllVideo(); // the group may have grown past the all-video size
        break;
      case "peer-left":
        this.removeParticipant(msg.peerId);
        break;
      case "peer-info":
        this.upsertParticipant(msg.peer);
        break;
      case "signal":
        this.onSignal(msg.from, msg.data);
        break;
      case "caption":
        this.onCaption(msg.from, msg.id, msg.stage, msg.text, msg.tail);
        break;
      case "own":
        this.upsertTranscript({ id: msg.id, who: "me", from: null, text: msg.text, final: msg.final });
        this.set({ ownLine: { text: msg.text, at: Date.now() } });
        break;
      case "captions":
        if (msg.side === "mine") this.set({ myCaptionStatus: msg.state });
        else if (msg.from) this.patchParticipant(msg.from, { captionStatus: msg.state });
        else this.set({ participants: this.state.participants.map((p) => ({ ...p, captionStatus: msg.state })), captionStatus: msg.state });
        this.set({ captionStatus: worst(this.state.participants.map((p) => p.captionStatus).concat(msg.from ? [] : [msg.state])) });
        break;
      case "speaking":
        if (msg.on) {
          this.lastSpeaker = msg.peer;
          if (msg.peer !== this.selfId) this.set({ activeId: msg.peer });
          this.applyAllVideo();
        }
        if (msg.peer !== this.selfId) this.patchParticipant(msg.peer, { speaking: msg.on });
        break;
      case "error":
        this.shutdown();
        this.releaseDevices();
        this.set({ phase: msg.code === "room-full" ? "full" : "gone", participants: [] });
        break;
    }
  }

  // --------------------------------------------------------------- WebRTC

  private ensureLink(id: string): Link {
    let link = this.links.get(id);
    if (!link) {
      link = {
        id,
        pc: null,
        session: "",
        offerer: false,
        pending: [],
        connectTimer: null,
        disconnectTimer: null,
        videoSender: null,
        audioSender: null,
        remoteTracks: new Map(),
        last: null,
        noVideoReports: 0,
        noAudioReports: 0,
        localVideoBad: 0,
        wasConnected: false,
        lostAt: null,
      };
      this.links.set(id, link);
    }
    return link;
  }

  private newPc(id: string, session: string, offerer: boolean): Link {
    this.closeLink(id);
    const link = this.ensureLink(id);
    link.session = session;
    link.offerer = offerer;
    // `?relay` on the call link forces every connection through the TURN relay (for testing it).
    const relayOnly = new URLSearchParams(location.search).has("relay");
    const pc = new RTCPeerConnection({ iceServers: this.iceServers, iceTransportPolicy: relayOnly ? "relay" : "all" });
    link.pc = pc;
    const audio = this.local.getAudioTracks()[0];
    if (audio) link.audioSender = pc.addTrack(audio, this.local);
    if (offerer) {
      // Always negotiate a two-way video slot, even with the camera off, so the camera can be
      // turned on later (or recovered) with replaceTrack and no renegotiation.
      link.videoSender = pc.addTransceiver("video", { direction: "sendrecv", streams: [this.local] }).sender;
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) this.send({ t: "signal", to: id, data: { kind: "candidate", session, candidate: e.candidate.toJSON() } });
    };
    pc.ontrack = (e) => {
      // Build our own stream per person so audio and video always end up together, whatever
      // stream ids the other browser attached.
      link.remoteTracks.set(e.track.kind, e.track);
      this.patchParticipant(id, { stream: new MediaStream([...link.remoteTracks.values()]) });
      this.updateMicRemote();
    };
    pc.onconnectionstatechange = () => this.onPcState(link, pc);
    pc.oniceconnectionstatechange = () => {
      // Safari reports some transitions only on the ICE state.
      if (pc.iceConnectionState === "failed") this.onPcState(link, pc, "failed");
    };
    this.patchParticipant(id, { connected: false, failed: false, videoOk: false });
    this.armConnectTimeout(link);
    this.recomputePhase();
    return link;
  }

  private async makeOffer(id: string, iceRestart = false) {
    try {
      const existing = this.links.get(id);
      const link = iceRestart && existing?.pc && existing.offerer ? existing : this.newPc(id, crypto.randomUUID(), true);
      const pc = link.pc!;
      if (!iceRestart) await this.applyVideoSender(link);
      const offer = await pc.createOffer({ iceRestart });
      await pc.setLocalDescription({ type: "offer", sdp: tuneOpus(offer.sdp ?? "") });
      this.send({ t: "signal", to: id, data: { kind: "offer", session: link.session, sdp: pc.localDescription!.sdp } });
    } catch (err) {
      this.log("offer_failed", { error: String(err) });
    }
  }

  private async onSignal(from: string, data: SignalData) {
    try {
      let link = this.links.get(from);
      if (data.kind === "offer") {
        const fresh = !(link?.pc && data.session === link.session);
        if (fresh) link = this.newPc(from, data.session, false);
        const pc = link!.pc!;
        await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
        if (fresh) {
          // Answerer: open our side of the offered video slot so we can send now or later.
          const t = pc.getTransceivers().find((x) => x.receiver.track.kind === "video");
          if (t) {
            t.direction = "sendrecv";
            link!.videoSender = t.sender;
            await this.applyVideoSender(link!);
          }
        }
        await this.flushCandidates(link!);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription({ type: "answer", sdp: tuneOpus(answer.sdp ?? "") });
        this.send({ t: "signal", to: from, data: { kind: "answer", session: link!.session, sdp: pc.localDescription!.sdp } });
      } else if (data.kind === "answer") {
        if (!link?.pc || data.session !== link.session || link.pc.signalingState !== "have-local-offer") return;
        await link.pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
        await this.flushCandidates(link);
      } else if (data.kind === "candidate") {
        if (!link || data.session !== link.session) return;
        if (link.pc?.remoteDescription) await link.pc.addIceCandidate(data.candidate).catch(() => {});
        else link.pending.push(data.candidate);
      } else if (data.kind === "restart-request") {
        if (link?.offerer) this.makeOffer(from, true);
      } else if (data.kind === "status") {
        this.onPeerStatus(from, data);
      }
    } catch (err) {
      this.log("signal_failed", { kind: data.kind, error: String(err) });
    }
  }

  private async flushCandidates(link: Link) {
    const list = link.pending;
    link.pending = [];
    for (const c of list) await link.pc?.addIceCandidate(c).catch(() => {});
  }

  private onPcState(link: Link, pc: RTCPeerConnection, override?: RTCPeerConnectionState) {
    if (pc !== link.pc) return;
    const s = override ?? pc.connectionState;
    if (s === "connected") {
      this.clearTimers(link);
      if (link.lostAt !== null) this.log("reconnected", { downMs: Date.now() - link.lostAt });
      link.lostAt = null;
      link.wasConnected = true;
      this.patchParticipant(link.id, { connected: true, failed: false });
      this.recomputePhase();
      // Tell them straight away whether to expect video from us, rather than after the first health check.
      this.sendStatus(link);
      this.logPath(link);
      this.prioritiseAudio(pc);
      this.startStatusLoop();
    } else if (s === "disconnected") {
      if (link.wasConnected) link.lostAt ??= Date.now();
      // Often transient (network switch). Give it a moment, then restart ICE.
      if (link.disconnectTimer) clearTimeout(link.disconnectTimer);
      link.disconnectTimer = setTimeout(() => {
        if (link.pc === pc && pc.connectionState !== "connected") this.restartIce(link);
      }, DISCONNECT_GRACE_MS);
    } else if (s === "failed") {
      if (link.wasConnected) link.lostAt ??= Date.now();
      this.log("ice_failed", { offerer: link.offerer, servers: this.iceServers.length });
      this.restartIce(link);
    }
  }

  private restartIce(link: Link) {
    // An ICE restart on a connection that is still up never fires a state change, so only
    // show "connecting" (and arm the failure timeout) when the connection is actually down.
    if (link.pc?.connectionState !== "connected") {
      this.patchParticipant(link.id, { connected: false });
      this.recomputePhase();
      this.armConnectTimeout(link);
    }
    if (link.offerer) this.makeOffer(link.id, true);
    else this.send({ t: "signal", to: link.id, data: { kind: "restart-request" } });
  }

  private armConnectTimeout(link: Link) {
    if (link.connectTimer) clearTimeout(link.connectTimer);
    link.connectTimer = setTimeout(
      () => {
        const p = this.participant(link.id);
        if (!p || p.connected) return;
        // A call that was working: keep trying quietly ("Reconnecting…") for a couple of minutes.
        if (link.wasConnected && link.lostAt !== null && Date.now() - link.lostAt < RECONNECT_FOR_MS) {
          this.restartIce(link);
          return;
        }
        this.log(link.wasConnected ? "gave_up" : "connect_timeout", { pcState: link.pc?.connectionState, ice: link.pc?.iceConnectionState, relay: this.iceServers.length > 1 });
        this.patchParticipant(link.id, { failed: true });
        this.recomputePhase();
      },
      link.wasConnected ? RETRY_EVERY_MS : CONNECT_TIMEOUT_MS,
    );
  }

  /**
   * The phone changed network (Wi-Fi ↔ mobile data) or came back online: reconnect signalling at
   * once and restart ICE, rather than waiting for the old network path to time out.
   */
  private onNetwork = (e: Event) => {
    if (this.stopped) return;
    if (!this.ws || this.ws.readyState > WebSocket.OPEN) {
      if (this.wsTimer) clearTimeout(this.wsTimer);
      this.wsRetry = 0;
      this.connectSocket();
    }
    for (const link of this.links.values()) {
      if (!link.pc) continue;
      if (e.type === "change" || link.pc.connectionState !== "connected") this.restartIce(link);
    }
  };

  private clearTimers(link: Link) {
    if (link.connectTimer) clearTimeout(link.connectTimer);
    if (link.disconnectTimer) clearTimeout(link.disconnectTimer);
    link.connectTimer = link.disconnectTimer = null;
  }

  private closeLink(id: string) {
    const link = this.links.get(id);
    if (!link) return;
    this.clearTimers(link);
    link.pending = [];
    if (link.pc) {
      link.pc.onicecandidate = link.pc.ontrack = link.pc.onconnectionstatechange = link.pc.oniceconnectionstatechange = null;
      link.pc.close();
    }
    this.links.delete(id);
    this.patchParticipant(id, { stream: null, connected: false, videoOk: false });
  }

  /** Voice matters more than picture: when bandwidth is short, the browser should starve video first. */
  private async prioritiseAudio(pc: RTCPeerConnection) {
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind !== "audio") continue;
      try {
        const p = sender.getParameters();
        if (!p.encodings?.length) continue;
        p.encodings = p.encodings.map((e) => ({ ...e, priority: "high", networkPriority: "high" }) as RTCRtpEncodingParameters);
        await sender.setParameters(p);
      } catch {}
    }
  }

  // ----------------------------------------------------- health checks

  private startStatusLoop() {
    if (this.statusTimer) return;
    this.weakChecks = this.goodChecks = 0;
    this.statusTimer = setInterval(() => this.checkHealth(), STATUS_EVERY_MS);
  }

  private stopStatusLoop() {
    if (this.statusTimer) clearInterval(this.statusTimer);
    this.statusTimer = null;
  }

  private sendStatus(link: Link, recv?: { video: boolean | null; audio: boolean | null }) {
    if (!link.pc) return;
    const p = this.participant(link.id);
    this.send({
      t: "signal",
      to: link.id,
      data: {
        kind: "status",
        cam: this.sendingVideo(link.id),
        wantVideo: !this.state.audioOnly,
        recvVideo: recv?.video ?? (p?.videoOk || null),
        recvAudio: recv?.audio ?? null,
        away: this.hidden,
      },
    });
  }
  private sendAllStatus() {
    for (const l of this.links.values()) this.sendStatus(l);
  }

  /** Every 2 s, per person: measure what's arriving, tell them, and watch for a weak connection. */
  private async checkHealth() {
    if (this.stopped) return;
    let anyWeak = false;
    let heal = false;
    let cpuLimited = false;
    for (const link of [...this.links.values()]) {
      const pc = link.pc;
      if (!pc || pc.connectionState !== "connected") continue;
      let stats: RTCStatsReport;
      try {
        stats = await pc.getStats();
      } catch {
        continue;
      }
      const c: MediaCounters = { framesDecoded: 0, audioPackets: 0, lost: 0, received: 0, framesSent: 0 };
      let rtt: number | null = null;
      let outBitrate: number | null = null;
      stats.forEach((r) => {
        if (r.type === "inbound-rtp") {
          if (r.kind === "video") c.framesDecoded += r.framesDecoded ?? 0;
          if (r.kind === "audio") c.audioPackets += r.packetsReceived ?? 0;
          c.lost += Math.max(0, r.packetsLost ?? 0);
          c.received += r.packetsReceived ?? 0;
        }
        if (r.type === "outbound-rtp" && r.kind === "video") {
          c.framesSent += r.framesSent ?? r.framesEncoded ?? 0;
          if (r.qualityLimitationReason === "cpu") cpuLimited = true;
        }
        if (r.type === "candidate-pair" && r.nominated && r.state === "succeeded") {
          if (r.currentRoundTripTime != null) rtt = r.currentRoundTripTime * 1000;
          if (r.availableOutgoingBitrate != null) outBitrate = r.availableOutgoingBitrate;
        }
      });
      const prev = link.last;
      link.last = c;
      if (!prev || pc !== link.pc) continue;

      // Local check: my camera is meant to be on for them but the track died or nothing is sent.
      if (this.sendingVideo(link.id)) {
        const v = this.liveVideo();
        const stalled = c.framesSent > 0 && c.framesSent <= prev.framesSent; // 0 = not started yet, not stalled
        link.localVideoBad = !v || v.muted || stalled ? link.localVideoBad + 1 : 0;
        if (link.localVideoBad >= 2) {
          link.localVideoBad = 0;
          heal = true;
        }
      } else link.localVideoBad = 0;

      const recvVideo = c.framesDecoded > prev.framesDecoded;
      const recvAudio = c.audioPackets > prev.audioPackets;
      const p = this.participant(link.id);
      if (p && recvVideo !== p.videoOk) this.patchParticipant(link.id, { videoOk: recvVideo });
      this.sendStatus(link, { video: recvVideo, audio: recvAudio });

      const dRecv = c.received - prev.received;
      const dLost = c.lost - prev.lost;
      const loss = dRecv + dLost > 0 ? dLost / (dRecv + dLost) : 0;
      if (loss > 0.08 || (rtt !== null && rtt > 700) || (this.sendingVideo(link.id) && outBitrate !== null && outBitrate < 200_000)) {
        anyWeak = true;
        if (this.weakChecks + 1 === WEAK_CHECKS_TO_WARN) {
          this.log("weak_network", { loss: Math.round(loss * 100), rtt: rtt ?? undefined, outKbps: outBitrate ? Math.round(outBitrate / 1000) : undefined });
        }
      }
    }
    if (heal) this.heal("video", false);

    if (anyWeak) {
      this.weakChecks++;
      this.goodChecks = 0;
    } else {
      this.goodChecks++;
      if (this.goodChecks >= 5) this.weakChecks = 0;
    }
    // First step is automatic and invisible: lower video quality. Then suggest audio only.
    if (this.weakChecks >= 2 && !this.degraded) await this.setVideoQuality(true);
    if (this.goodChecks >= 8 && this.degraded) await this.setVideoQuality(false);

    // The phone can't keep up encoding video (hot, charging, low power mode): lighten the video
    // a step at a time so the call and its audio stay smooth; go back up after a minute of calm.
    if (cpuLimited) {
      this.cpuOkChecks = 0;
      if (++this.cpuChecks >= 2 && this.cpuLevel < CPU_STEPS.length - 1) {
        this.cpuLevel++;
        this.cpuChecks = 0;
        this.log("cpu_limited", { level: this.cpuLevel });
        await this.applyVideoEncoding();
      }
    } else {
      this.cpuChecks = 0;
      if (this.cpuLevel > 0 && ++this.cpuOkChecks >= 30) {
        this.cpuLevel--;
        this.cpuOkChecks = 0;
        await this.applyVideoEncoding();
      }
    }
    const suggest = this.weakChecks >= WEAK_CHECKS_TO_WARN && !this.state.audioOnly && Date.now() - this.weakDismissedAt > 60_000;
    this.setProblem("weak-network", suggest);
  }

  private async setVideoQuality(low: boolean) {
    this.degraded = low;
    await this.applyVideoEncoding();
  }

  /** Video sending settings from network quality (degraded) and processor load (cpuLevel). */
  private async applyVideoEncoding() {
    const step = CPU_STEPS[this.cpuLevel];
    const scale = Math.max(this.degraded ? 2 : 1, step.scale);
    const maxBitrate = this.degraded ? 250_000 : Math.round((isMobileDevice() ? 900_000 : 1_200_000) / (step.scale * step.scale) + 150_000);
    for (const link of this.links.values()) {
      const sender = link.videoSender;
      if (!sender) continue;
      try {
        const p = sender.getParameters();
        if (!p.encodings?.length) continue;
        p.encodings = p.encodings.map((e) => ({ ...e, maxBitrate, scaleResolutionDownBy: scale, maxFramerate: step.fps }));
        await sender.setParameters(p);
      } catch {}
    }
  }

  /** What one person says they are receiving from me. */
  private onPeerStatus(from: string, s: PeerStatus) {
    const p = this.participant(from);
    const link = this.links.get(from);
    if (!p || !link) return;
    const partnerAudioOnly = !s.wantVideo;
    if (partnerAudioOnly !== p.partnerAudioOnly) {
      this.patchParticipant(from, { partnerAudioOnly });
      this.applyVideoSender(link);
    }
    if (s.cam !== p.remoteCam) this.patchParticipant(from, { remoteCam: s.cam });
    if (!!s.away !== p.away) this.patchParticipant(from, { away: !!s.away });
    if (s.away) return; // their phone isn't measuring anything while they're in another app

    // "They can't see you": I'm sending them video but frames aren't arriving there.
    link.noVideoReports = this.sendingVideo(from) && s.recvVideo === false ? link.noVideoReports + 1 : 0;
    // "They can't hear you". Not while muted: some browsers stop sending packets for a muted track.
    link.noAudioReports = s.recvAudio === false && !this.state.muted ? link.noAudioReports + 1 : 0;

    const links = [...this.links.values()];
    const cantSee = links.some((l) => l.noVideoReports >= BAD_REPORTS_TO_ACT);
    const cantHear = links.some((l) => l.noAudioReports >= BAD_REPORTS_TO_ACT);
    this.setProblem("they-cant-see-you", cantSee);
    this.setProblem("they-cant-hear-you", cantHear);
    if (link.noVideoReports >= BAD_REPORTS_TO_ACT) this.heal("video", false);
    if (link.noAudioReports >= BAD_REPORTS_TO_ACT) this.heal("audio", false);
  }

  /**
   * Try to get media flowing again without the user doing anything: first a fresh local
   * camera/mic track, and if that doesn't help, fresh network paths (ICE restart) to the
   * people still reporting a problem.
   */
  private async heal(kind: "video" | "audio", force: boolean) {
    const now = Date.now();
    if (!force && now - this.lastHeal < 15_000) return;
    const escalate = !force && this.lastHeal > 0 && now - this.lastHeal < 40_000;
    this.lastHeal = now;
    this.log("heal", { kind, escalate, people: this.links.size });
    if (kind === "video" && this.state.camOn) {
      // Replace the camera track even if it looks live: iOS can leave a "live" track that sends nothing.
      this.dropLocalVideo();
      const ok = await this.ensureCamera();
      this.setProblem("camera-failed", !ok);
      for (const l of this.links.values()) await l.videoSender?.replaceTrack(null).catch(() => {});
      await this.applyAllVideo();
    }
    await this.recoverLocalTracks();
    if (escalate || force) {
      for (const l of this.links.values()) {
        if (force || l.noVideoReports >= BAD_REPORTS_TO_ACT || l.noAudioReports >= BAD_REPORTS_TO_ACT) this.restartIce(l);
      }
    }
  }

  /** Log whether ICE resolved direct (host/srflx/prflx) or via TURN relay. */
  private async logPath(link: Link) {
    try {
      const stats = await link.pc!.getStats();
      let pair: RTCIceCandidatePairStats | undefined;
      stats.forEach((r) => {
        if (r.type === "transport" && r.selectedCandidatePairId) pair = stats.get(r.selectedCandidatePairId);
      });
      if (!pair) stats.forEach((r) => r.type === "candidate-pair" && r.nominated && r.state === "succeeded" && (pair = r));
      if (!pair) return;
      const local = stats.get(pair.localCandidateId);
      const remote = stats.get(pair.remoteCandidateId);
      this.log("ice_connected", {
        path: local?.candidateType === "relay" || remote?.candidateType === "relay" ? "relay" : "direct",
        local: local?.candidateType,
        remote: remote?.candidateType,
        protocol: local?.protocol,
        rttMs: pair.currentRoundTripTime != null ? Math.round(pair.currentRoundTripTime * 1000) : undefined,
        people: this.state.participants.length + 1,
        camOn: this.state.camOn,
        audioOnly: this.state.audioOnly,
        inRoom: this.state.inRoom,
      });
    } catch {}
  }

  // -------------------------------------------------------------- captions

  private onCaption(from: string, id: string, stage: CaptionStage, text: string, tail?: string) {
    const now = Date.now();
    const captions = this.state.captions.filter((c) => c.doneAt === null || now - c.doneAt < 30_000);
    const i = captions.findIndex((c) => c.id === id);
    const done = stage === "final" || stage === "refined";
    if (i >= 0) {
      if (captions[i].doneAt !== null) return; // never mutate a settled line
      captions[i] = { ...captions[i], text, tail, stage, updatedAt: now, doneAt: done ? now : null };
    } else if (text || tail) {
      captions.push({ id, from, text, tail, stage, updatedAt: now, doneAt: done ? now : null });
    }
    this.set({ captions: captions.filter((c) => c.text || c.tail) });
    // The transcript keeps settled words only, never the preview.
    if (text) this.upsertTranscript({ id, who: "them", from, text, final: done });
  }

  private upsertTranscript(line: Omit<TranscriptLine, "at">) {
    const transcript = [...this.state.transcript];
    const i = transcript.findIndex((l) => l.id === line.id);
    if (i >= 0) {
      if (!line.text) transcript.splice(i, 1);
      else transcript[i] = { ...transcript[i], ...line };
    } else if (line.text) transcript.push({ ...line, at: Date.now() });
    this.set({ transcript });
  }
}

export function worst(states: CaptionState[]): CaptionState {
  return states.includes("unavailable") ? "unavailable" : states.includes("paused") ? "paused" : "ok";
}
