"use client";
import type { ParticipantLang } from "@/shared/lang";
import type { CaptionStage, CaptionState, ClientMsg, PeerStatus, ServerMsg, SignalData } from "@/shared/protocol";
import { MicCapture } from "./audio";
import { getCameraTrack, getMicTrack, hasMultipleCameras } from "./media";

export type Phase =
  | "joining" // socket connecting / join in flight
  | "waiting" // alone in the room
  | "connecting" // partner present, WebRTC negotiating
  | "connected"
  | "failed" // couldn't connect: show a plain error, never a black screen
  | "ended" // we hung up
  | "gone" // room expired / not found
  | "full"
  | "replaced";

export type Caption = { id: string; text: string; stage: CaptionStage; updatedAt: number; doneAt: number | null };
export type TranscriptLine = { id: string; who: "me" | "them"; text: string; final: boolean; at: number };

/** A problem one side can see about the call, shown as a banner with an action where one helps. */
export type Problem =
  | "they-cant-see-you" // my camera is on but my video isn't arriving at their end
  | "they-cant-hear-you" // my audio isn't arriving at their end
  | "camera-failed" // couldn't (re)start my camera
  | "weak-network"; // suggest audio only

export type CallState = {
  phase: Phase;
  peerLeft: boolean;
  reconnecting: boolean;
  remoteStream: MediaStream | null;
  captions: Caption[];
  transcript: TranscriptLine[];
  /** Captions of the other person reaching me. */
  captionStatus: CaptionState;
  /** Captions of my speech reaching them. */
  myCaptionStatus: CaptionState;
  muted: boolean;
  /** My camera is on (it may still be paused for the other side if they chose audio only). */
  camOn: boolean;
  /** I chose audio only: no video sent or received. */
  audioOnly: boolean;
  /** The other side chose audio only, so I'm not sending them video. */
  partnerAudioOnly: boolean;
  /** The other side says their camera is on (null until they report). */
  remoteCam: boolean | null;
  /** Their video frames are actually arriving and decoding here. */
  remoteVideoOk: boolean;
  canSwitchCamera: boolean;
  /** My voice is being picked up right now (the mic gate is open). */
  meSpeaking: boolean;
  partnerSpeaking: boolean;
  /** What my own self-view shows (a fresh stream whenever the camera track changes). */
  selfVideo: MediaStream | null;
  /** My latest recognised words, so I can see captions of me are working. */
  ownLine: { text: string; at: number } | null;
  problems: Problem[];
};

const CONNECT_TIMEOUT_MS = 20_000;
const DISCONNECT_GRACE_MS = 4_000;
const STATUS_EVERY_MS = 2_000;
/** Consecutive bad reports (x 2 s) before we act on "they can't see / hear you". */
const BAD_REPORTS_TO_ACT = 3;
const WEAK_CHECKS_TO_WARN = 4;

type MediaCounters = { framesDecoded: number; audioPackets: number; lost: number; received: number; framesSent: number };

/**
 * Owns one call: the signalling socket (which also carries our mic audio and their captions),
 * the RTCPeerConnection, the mic tap, camera state, and the media health checks.
 * UI subscribes to state snapshots.
 */
export class CallController {
  state: CallState;
  private listeners = new Set<() => void>();
  private ws: WebSocket | null = null;
  private wsRetry = 0;
  private wsTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private iceServers: RTCIceServer[] = [];
  private partner: ParticipantLang | null = null;

  private pc: RTCPeerConnection | null = null;
  private session = "";
  private offerer = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private videoSender: RTCRtpSender | null = null;
  private audioSender: RTCRtpSender | null = null;
  private remoteTracks = new Map<string, MediaStreamTrack>(); // by kind

  private mic: MicCapture | null = null;
  private facing: "user" | "environment" = "user";
  private cameraBusy = false;

  private statusTimer: ReturnType<typeof setInterval> | null = null;
  private lastCounters: MediaCounters | null = null;
  private noVideoReports = 0;
  private localVideoBad = 0;
  private noAudioReports = 0;
  private weakChecks = 0;
  private goodChecks = 0;
  private degraded = false;
  private lastHeal = 0;
  private weakDismissedAt = 0;

  constructor(
    private room: string,
    private peerId: string,
    private lang: ParticipantLang,
    /** Our local stream. Its tracks change as the camera turns on/off or is recovered. */
    readonly local: MediaStream,
    opts: { audioOnly?: boolean } = {},
  ) {
    const hasVideo = local.getVideoTracks().some((t) => t.readyState === "live");
    const audioOnly = !!opts.audioOnly;
    if (audioOnly) this.dropLocalVideo();
    this.state = {
      phase: "joining",
      peerLeft: false,
      reconnecting: false,
      remoteStream: null,
      captions: [],
      transcript: [],
      captionStatus: "ok",
      myCaptionStatus: "ok",
      muted: false,
      camOn: hasVideo && !audioOnly,
      audioOnly,
      partnerAudioOnly: false,
      remoteCam: null,
      remoteVideoOk: false,
      canSwitchCamera: false,
      meSpeaking: false,
      partnerSpeaking: false,
      ownLine: null,
      problems: [],
      selfVideo: null,
    };
    this.state.selfVideo = this.makeSelfStream();
  }

  private makeSelfStream(): MediaStream | null {
    const v = this.liveVideo();
    return v ? new MediaStream([v]) : null;
  }
  private refreshSelf() {
    this.set({ selfVideo: this.makeSelfStream() });
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

  /** Must be called from the Join tap (user gesture) so iOS allows audio. */
  async start() {
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
    this.set({ phase: "ended", remoteStream: null, selfVideo: null });
  }

  /** Turn the camera light and mic off as soon as the call is over. */
  private releaseDevices() {
    for (const t of this.local.getTracks()) {
      t.onended = null;
      t.stop();
    }
  }

  setMuted(muted: boolean) {
    for (const t of this.local.getAudioTracks()) t.enabled = !muted;
    if (this.mic) this.mic.enabled = !muted;
    this.set({ muted });
  }

  retry() {
    this.closePc();
    this.set({ phase: "connecting" });
    this.send({ t: "need-offer" });
    this.armConnectTimeout();
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
    await this.applyVideoSender();
    this.sendStatus();
  }

  /** Audio only: stop my camera and ask the other side to stop sending video. Captions keep working. */
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
    this.sendStatus();
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
    await this.applyVideoSender();
  }

  dismissProblem(p: Problem) {
    if (p === "weak-network") this.weakDismissedAt = Date.now();
    this.setProblem(p, false);
  }

  /** Manual "fix video" from the banner: fresh camera track, then a fresh connection path. */
  async fixVideo() {
    this.lastHeal = 0;
    await this.heal("video", true);
  }

  private onVisible = () => {
    if (document.visibilityState !== "visible") return;
    this.mic?.resume();
    // iOS pauses or ends the camera and mic while Safari is in the background (e.g. switching to
    // WhatsApp to send the link). Bring them back as soon as we're visible again.
    setTimeout(() => this.recoverLocalTracks(), 800);
  };

  private shutdown() {
    this.stopped = true;
    document.removeEventListener("visibilitychange", this.onVisible);
    if (this.wsTimer) clearTimeout(this.wsTimer);
    this.closePc();
    this.mic?.stop();
    this.mic = null;
    this.ws?.close();
    this.ws = null;
  }

  dispose() {
    if (!this.stopped) this.shutdown();
    this.listeners.clear();
  }

  // --------------------------------------------------------- local media

  private startMic(track: MediaStreamTrack | undefined) {
    this.mic?.stop();
    this.mic = null;
    if (!track) return;
    this.mic = new MicCapture(
      track,
      (pcm) => this.sendAudio(pcm),
      (on) => {
        this.send({ t: "speech", on });
        this.set({ meSpeaking: on });
      },
    );
    this.mic.enabled = !this.state?.muted;
    this.mic.start().catch((err) => this.log("mic_tap_failed", { error: String(err) }));
    if (this.pc) this.mic.setRemote(this.state.remoteStream);
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
        await this.audioSender?.replaceTrack(track);
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
        await this.applyVideoSender();
      }
    }
    this.sendStatus();
  }

  /** What actually goes out on the video sender: my camera, unless it's off or they asked for audio only. */
  private async applyVideoSender() {
    if (!this.videoSender) return;
    const track = this.state.camOn && !this.state.partnerAudioOnly ? this.liveVideo() : null;
    if (this.videoSender.track === track) return;
    try {
      await this.videoSender.replaceTrack(track);
    } catch (err) {
      this.log("replace_track_failed", { error: String(err) });
    }
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
      ws.send(JSON.stringify({ t: "join", room: this.room, peerId: this.peerId, lang: this.lang } satisfies ClientMsg));
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
        this.set({ phase: "replaced", remoteStream: null });
        return;
      }
      // Signalling dropped; the WebRTC call may well still be up. Reconnect quietly.
      this.set({ reconnecting: true });
      const delay = Math.min(5000, 500 * 2 ** this.wsRetry++);
      this.wsTimer = setTimeout(() => this.connectSocket(), delay);
    };
  }

  private send(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private sendAudio(pcm: ArrayBuffer) {
    // Only stream while someone is there to read the captions.
    if (this.partner && this.ws?.readyState === WebSocket.OPEN && this.ws.bufferedAmount < 64_000) this.ws.send(pcm);
  }

  private log(event: string, detail: Record<string, unknown> = {}) {
    this.send({ t: "log", event, detail });
  }

  private onServer(msg: ServerMsg) {
    switch (msg.t) {
      case "joined": {
        this.iceServers = msg.iceServers;
        this.partner = msg.partner;
        this.set({ reconnecting: false });
        if (!msg.partner) {
          this.set({ phase: "waiting" });
        } else if (this.pc && ["connected", "connecting", "new"].includes(this.pc.connectionState)) {
          // Signalling blipped but the call itself is fine.
        } else {
          // A brand-new seat waits: the server has already told the partner to offer.
          // A returning seat (reload, socket drop with a dead call) asks the partner to offer again.
          if (!msg.fresh) this.send({ t: "need-offer" });
          this.set({ phase: "connecting" });
          this.armConnectTimeout();
        }
        // Coming back from the background is when iOS cameras need reviving.
        this.recoverLocalTracks();
        break;
      }
      case "peer-joined":
        this.partner = msg.partner;
        this.set({ peerLeft: false });
        if (msg.offer) this.makeOffer();
        break;
      case "peer-left":
        this.partner = null;
        this.closePc();
        this.set({
          phase: "waiting",
          peerLeft: true,
          remoteStream: null,
          captions: [],
          partnerSpeaking: false,
          remoteCam: null,
          partnerAudioOnly: false,
          problems: this.state.problems.filter((p) => p === "camera-failed"),
        });
        break;
      case "signal":
        this.onSignal(msg.data);
        break;
      case "caption":
        this.onCaption(msg.id, msg.stage, msg.text);
        break;
      case "own":
        this.upsertTranscript({ id: msg.id, who: "me", text: msg.text, final: msg.final });
        this.set({ ownLine: { text: msg.text, at: Date.now() } });
        break;
      case "captions":
        this.set(msg.side === "mine" ? { myCaptionStatus: msg.state } : { captionStatus: msg.state });
        break;
      case "partner-speech":
        this.set({ partnerSpeaking: msg.on });
        break;
      case "error":
        this.shutdown();
        this.releaseDevices();
        this.set({ phase: msg.code === "room-full" ? "full" : "gone", remoteStream: null });
        break;
    }
  }

  // --------------------------------------------------------------- WebRTC

  private newPc(session: string, offerer: boolean) {
    this.closePc();
    this.session = session;
    this.offerer = offerer;
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.pc = pc;
    const audio = this.local.getAudioTracks()[0];
    if (audio) this.audioSender = pc.addTrack(audio, this.local);
    if (offerer) {
      // Always negotiate a two-way video slot, even with the camera off, so the camera can be
      // turned on later (or recovered) with replaceTrack and no renegotiation.
      const t = pc.addTransceiver("video", { direction: "sendrecv", streams: [this.local] });
      this.videoSender = t.sender;
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) this.send({ t: "signal", data: { kind: "candidate", session, candidate: e.candidate.toJSON() } });
    };
    pc.ontrack = (e) => {
      // Build our own remote stream so audio and video always end up together, whatever
      // stream ids the other browser attached (Firefox can't re-associate on replaceTrack).
      this.remoteTracks.set(e.track.kind, e.track);
      const stream = new MediaStream([...this.remoteTracks.values()]);
      this.set({ remoteStream: stream });
      this.mic?.setRemote(stream);
    };
    pc.onconnectionstatechange = () => this.onPcState(pc);
    pc.oniceconnectionstatechange = () => {
      // Safari reports some transitions only on the ICE state.
      if (pc.iceConnectionState === "failed") this.onPcState(pc, "failed");
    };
    this.set({ phase: "connecting", remoteVideoOk: false });
    this.armConnectTimeout();
    return pc;
  }

  private async makeOffer(iceRestart = false) {
    try {
      const pc = iceRestart && this.pc && this.offerer ? this.pc : this.newPc(crypto.randomUUID(), true);
      if (!iceRestart) await this.applyVideoSender();
      const offer = await pc.createOffer({ iceRestart });
      await pc.setLocalDescription(offer);
      this.send({ t: "signal", data: { kind: "offer", session: this.session, sdp: pc.localDescription!.sdp } });
    } catch (err) {
      this.log("offer_failed", { error: String(err) });
    }
  }

  private async onSignal(data: SignalData) {
    try {
      if (data.kind === "offer") {
        const fresh = !(data.session === this.session && this.pc);
        const pc = fresh ? this.newPc(data.session, false) : this.pc!;
        await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
        if (fresh) {
          // Answerer: open our side of the offered video slot so we can send now or later.
          const t = pc.getTransceivers().find((x) => x.receiver.track.kind === "video");
          if (t) {
            t.direction = "sendrecv";
            this.videoSender = t.sender;
            await this.applyVideoSender();
          }
        }
        await this.flushCandidates();
        await pc.setLocalDescription(await pc.createAnswer());
        this.send({ t: "signal", data: { kind: "answer", session: this.session, sdp: pc.localDescription!.sdp } });
      } else if (data.kind === "answer") {
        if (data.session !== this.session || !this.pc || this.pc.signalingState !== "have-local-offer") return;
        await this.pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
        await this.flushCandidates();
      } else if (data.kind === "candidate") {
        if (data.session !== this.session) return;
        if (this.pc?.remoteDescription) await this.pc.addIceCandidate(data.candidate).catch(() => {});
        else this.pendingCandidates.push(data.candidate);
      } else if (data.kind === "restart-request") {
        if (this.offerer) this.makeOffer(true);
      } else if (data.kind === "status") {
        this.onPeerStatus(data);
      }
    } catch (err) {
      this.log("signal_failed", { kind: data.kind, error: String(err) });
    }
  }

  private async flushCandidates() {
    const list = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const c of list) await this.pc?.addIceCandidate(c).catch(() => {});
  }

  private onPcState(pc: RTCPeerConnection, override?: RTCPeerConnectionState) {
    if (pc !== this.pc) return;
    const s = override ?? pc.connectionState;
    if (s === "connected") {
      this.clearTimers();
      this.set({ phase: "connected" });
      this.logPath(pc);
      this.prioritiseAudio(pc);
      this.startStatusLoop();
    } else if (s === "disconnected") {
      // Often transient (network switch). Give it a moment, then restart ICE.
      if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
      this.disconnectTimer = setTimeout(() => {
        if (this.pc === pc && pc.connectionState !== "connected") this.restartIce();
      }, DISCONNECT_GRACE_MS);
    } else if (s === "failed") {
      this.log("ice_failed", { offerer: this.offerer, servers: this.iceServers.length });
      this.restartIce();
    }
  }

  private restartIce() {
    // An ICE restart on a connection that is still up never fires a state change, so only
    // show "Connecting…" (and arm the failure timeout) when the connection is actually down.
    if (this.pc?.connectionState !== "connected") {
      if (this.state.phase === "connected") this.set({ phase: "connecting" });
      this.armConnectTimeout();
    }
    if (this.offerer) this.makeOffer(true);
    else this.send({ t: "signal", data: { kind: "restart-request" } });
  }

  private armConnectTimeout() {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.connectTimer = setTimeout(() => {
      if (this.state.phase === "connecting") {
        this.log("connect_timeout", { pcState: this.pc?.connectionState, ice: this.pc?.iceConnectionState });
        this.set({ phase: "failed" });
      }
    }, CONNECT_TIMEOUT_MS);
  }

  private clearTimers() {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    this.connectTimer = this.disconnectTimer = null;
  }

  private closePc() {
    this.clearTimers();
    this.stopStatusLoop();
    this.pendingCandidates = [];
    if (this.pc) {
      this.pc.onicecandidate = this.pc.ontrack = this.pc.onconnectionstatechange = this.pc.oniceconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    this.videoSender = this.audioSender = null;
    this.remoteTracks.clear();
    this.session = "";
    this.degraded = false;
    this.mic?.setRemote(null);
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
    this.lastCounters = null;
    this.noVideoReports = this.noAudioReports = this.weakChecks = this.goodChecks = 0;
    this.statusTimer = setInterval(() => this.checkHealth(), STATUS_EVERY_MS);
  }

  private stopStatusLoop() {
    if (this.statusTimer) clearInterval(this.statusTimer);
    this.statusTimer = null;
  }

  /** I mean to be sending video (camera on, and they haven't asked for audio only), whether or not it's working. */
  private sendingVideo(): boolean {
    return this.state.camOn && !this.state.partnerAudioOnly;
  }

  private sendStatus(recv?: { video: boolean | null; audio: boolean | null }) {
    if (!this.pc) return;
    this.send({
      t: "signal",
      data: {
        kind: "status",
        cam: this.sendingVideo(),
        wantVideo: !this.state.audioOnly,
        recvVideo: recv?.video ?? (this.state.remoteVideoOk || null),
        recvAudio: recv?.audio ?? null,
      },
    });
  }

  /** Every 2 s: measure what's arriving, tell the other side, and watch for a weak connection. */
  private async checkHealth() {
    const pc = this.pc;
    if (!pc || this.stopped) return;
    let stats: RTCStatsReport;
    try {
      stats = await pc.getStats();
    } catch {
      return;
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
      if (r.type === "outbound-rtp" && r.kind === "video") c.framesSent += r.framesSent ?? r.framesEncoded ?? 0;
      if (r.type === "candidate-pair" && r.nominated && r.state === "succeeded") {
        if (r.currentRoundTripTime != null) rtt = r.currentRoundTripTime * 1000;
        if (r.availableOutgoingBitrate != null) outBitrate = r.availableOutgoingBitrate;
      }
    });
    const prev = this.lastCounters;
    this.lastCounters = c;
    if (!prev || pc !== this.pc) return;

    // Local check: my camera is meant to be on but the track died, or nothing is being sent.
    // (iOS can end or silently stall the camera; this catches it without waiting for the other side.)
    if (this.sendingVideo()) {
      const v = this.liveVideo();
      const stalled = c.framesSent > 0 && c.framesSent <= prev.framesSent; // 0 = not started yet, not stalled
      this.localVideoBad = !v || v.muted || stalled ? this.localVideoBad + 1 : 0;
      if (this.localVideoBad >= 2) {
        this.localVideoBad = 0;
        this.heal("video", false);
      }
    } else this.localVideoBad = 0;

    const recvVideo = c.framesDecoded > prev.framesDecoded;
    const recvAudio = c.audioPackets > prev.audioPackets;
    if (recvVideo !== this.state.remoteVideoOk) this.set({ remoteVideoOk: recvVideo });
    this.sendStatus({ video: recvVideo, audio: recvAudio });

    // Weak connection: lost packets, long round trips, or too little upstream for video.
    const dRecv = c.received - prev.received;
    const loss = dRecv + (c.lost - prev.lost) > 0 ? (c.lost - prev.lost) / (dRecv + (c.lost - prev.lost)) : 0;
    const weak =
      loss > 0.08 || (rtt !== null && rtt > 700) || (this.sendingVideo() && outBitrate !== null && outBitrate < 200_000);
    if (weak) {
      this.weakChecks++;
      this.goodChecks = 0;
    } else {
      this.goodChecks++;
      if (this.goodChecks >= 5) this.weakChecks = 0;
    }
    // First step is automatic and invisible: lower video quality. Then suggest audio only.
    if (this.weakChecks >= 2 && !this.degraded) await this.setVideoQuality(true);
    if (this.goodChecks >= 8 && this.degraded) await this.setVideoQuality(false);
    const suggest =
      this.weakChecks >= WEAK_CHECKS_TO_WARN && !this.state.audioOnly && Date.now() - this.weakDismissedAt > 60_000;
    this.setProblem("weak-network", suggest);
    if (weak && this.weakChecks === WEAK_CHECKS_TO_WARN) {
      this.log("weak_network", { loss: Math.round(loss * 100), rtt: rtt ?? undefined, outKbps: outBitrate ? Math.round(outBitrate / 1000) : undefined });
    }
  }

  private async setVideoQuality(low: boolean) {
    this.degraded = low;
    const sender = this.videoSender;
    if (!sender) return;
    try {
      const p = sender.getParameters();
      if (!p.encodings?.length) return;
      p.encodings = p.encodings.map((e) => ({ ...e, maxBitrate: low ? 250_000 : 1_200_000, scaleResolutionDownBy: low ? 2 : 1 }));
      await sender.setParameters(p);
    } catch {}
  }

  /** What the other side says it is receiving from me. */
  private onPeerStatus(s: PeerStatus) {
    const partnerAudioOnly = !s.wantVideo;
    if (partnerAudioOnly !== this.state.partnerAudioOnly) {
      this.set({ partnerAudioOnly });
      this.applyVideoSender();
    }
    if (s.cam !== this.state.remoteCam) this.set({ remoteCam: s.cam });

    // "They can't see you": I'm sending video but frames aren't arriving there.
    if (this.sendingVideo() && s.recvVideo === false) this.noVideoReports++;
    else this.noVideoReports = 0;
    const cantSee = this.noVideoReports >= BAD_REPORTS_TO_ACT;
    this.setProblem("they-cant-see-you", cantSee);
    if (cantSee) this.heal("video", false);

    // "They can't hear you". Not while muted: some browsers stop sending packets for a muted track.
    if (s.recvAudio === false && !this.state.muted) this.noAudioReports++;
    else this.noAudioReports = 0;
    const cantHear = this.noAudioReports >= BAD_REPORTS_TO_ACT;
    this.setProblem("they-cant-hear-you", cantHear);
    if (cantHear) this.heal("audio", false);
  }

  /**
   * Try to get media flowing again without the user doing anything: first a fresh local
   * camera/mic track, and if that doesn't help, a fresh network path (ICE restart).
   */
  private async heal(kind: "video" | "audio", force: boolean) {
    const now = Date.now();
    if (!force && now - this.lastHeal < 15_000) return;
    const escalate = !force && this.lastHeal > 0 && now - this.lastHeal < 40_000;
    this.lastHeal = now;
    this.log("heal", { kind, escalate, noVideo: this.noVideoReports, noAudio: this.noAudioReports });
    if (kind === "video" && this.state.camOn) {
      // Replace the camera track even if it looks live: iOS can leave a "live" track that sends nothing.
      this.dropLocalVideo();
      const ok = await this.ensureCamera();
      this.setProblem("camera-failed", !ok);
      if (this.videoSender) await this.videoSender.replaceTrack(null).catch(() => {});
      await this.applyVideoSender();
    }
    await this.recoverLocalTracks();
    if (escalate || force) this.restartIce();
  }

  /** Log whether ICE resolved direct (host/srflx/prflx) or via TURN relay. */
  private async logPath(pc: RTCPeerConnection) {
    try {
      const stats = await pc.getStats();
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
        camOn: this.state.camOn,
        audioOnly: this.state.audioOnly,
      });
    } catch {}
  }

  // -------------------------------------------------------------- captions

  private onCaption(id: string, stage: CaptionStage, text: string) {
    const now = Date.now();
    const captions = this.state.captions.filter((c) => c.doneAt === null || now - c.doneAt < 10_000);
    const i = captions.findIndex((c) => c.id === id);
    const done = stage !== "live";
    if (i >= 0) {
      if (captions[i].doneAt !== null) return; // never mutate a settled line
      captions[i] = { ...captions[i], text, stage, updatedAt: now, doneAt: done ? now : null };
    } else if (text) {
      captions.push({ id, text, stage, updatedAt: now, doneAt: done ? now : null });
    }
    this.set({ captions: captions.filter((c) => c.text) });
    this.upsertTranscript({ id, who: "them", text, final: done });
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
