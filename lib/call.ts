"use client";
import type { ParticipantLang } from "@/shared/lang";
import type { CaptionStage, ClientMsg, ServerMsg, SignalData } from "@/shared/protocol";
import { MicCapture } from "./audio";

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

export type CallState = {
  phase: Phase;
  peerLeft: boolean;
  reconnecting: boolean;
  remoteStream: MediaStream | null;
  captions: Caption[];
  transcript: TranscriptLine[];
  captionStatus: "ok" | "paused" | "unavailable";
  muted: boolean;
};

const CONNECT_TIMEOUT_MS = 20_000;
const DISCONNECT_GRACE_MS = 4_000;

/**
 * Owns one call: the signalling socket (which also carries our mic audio and their captions),
 * the RTCPeerConnection, and the mic tap. UI subscribes to state snapshots.
 */
export class CallController {
  state: CallState = {
    phase: "joining",
    peerLeft: false,
    reconnecting: false,
    remoteStream: null,
    captions: [],
    transcript: [],
    captionStatus: "ok",
    muted: false,
  };
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

  private mic: MicCapture | null = null;

  constructor(
    private room: string,
    private peerId: string,
    private lang: ParticipantLang,
    private local: MediaStream,
  ) {}

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;
  private set(patch: Partial<CallState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  /** Must be called from the Join tap (user gesture) so iOS allows audio. */
  async start() {
    const track = this.local.getAudioTracks()[0];
    if (track) {
      this.mic = new MicCapture(
        track,
        (pcm) => this.sendAudio(pcm),
        (on) => this.send({ t: "speech", on }),
      );
      this.mic.start().catch((err) => this.log("mic_tap_failed", { error: String(err) }));
    }
    document.addEventListener("visibilitychange", this.onVisible);
    this.connectSocket();
  }

  leave() {
    this.send({ t: "leave" });
    this.shutdown();
    this.set({ phase: "ended", remoteStream: null });
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

  private onVisible = () => {
    if (document.visibilityState === "visible") this.mic?.resume();
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
        this.set({ phase: "waiting", peerLeft: true, remoteStream: null, captions: [] });
        break;
      case "signal":
        this.onSignal(msg.data);
        break;
      case "caption":
        this.onCaption(msg.id, msg.stage, msg.text);
        break;
      case "own":
        this.upsertTranscript({ id: msg.id, who: "me", text: msg.text, final: msg.final });
        break;
      case "captions":
        this.set({ captionStatus: msg.state });
        break;
      case "error":
        this.shutdown();
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
    for (const track of this.local.getTracks()) pc.addTrack(track, this.local);
    pc.onicecandidate = (e) => {
      if (e.candidate) this.send({ t: "signal", data: { kind: "candidate", session, candidate: e.candidate.toJSON() } });
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      if (this.state.remoteStream !== stream) {
        this.set({ remoteStream: stream });
        this.mic?.setRemote(stream);
      }
    };
    pc.onconnectionstatechange = () => this.onPcState(pc);
    pc.oniceconnectionstatechange = () => {
      // Safari reports some transitions only on the ICE state.
      if (pc.iceConnectionState === "failed") this.onPcState(pc, "failed");
    };
    this.set({ phase: "connecting" });
    this.armConnectTimeout();
    return pc;
  }

  private async makeOffer(iceRestart = false) {
    try {
      const pc = iceRestart && this.pc && this.offerer ? this.pc : this.newPc(crypto.randomUUID(), true);
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
        const pc = data.session === this.session && this.pc ? this.pc : this.newPc(data.session, false);
        await pc.setRemoteDescription({ type: "offer", sdp: data.sdp });
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
    if (this.state.phase === "connected") this.set({ phase: "connecting" });
    this.armConnectTimeout();
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
    this.pendingCandidates = [];
    if (this.pc) {
      this.pc.onicecandidate = this.pc.ontrack = this.pc.onconnectionstatechange = this.pc.oniceconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    this.session = "";
    this.mic?.setRemote(null);
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
