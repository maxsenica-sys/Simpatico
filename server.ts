import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { WebSocketServer, type WebSocket } from "ws";
import { sanitizeLang } from "./shared/lang";
import type { ClientMsg } from "./shared/protocol";
import { clientError, dashboard, feedback } from "./server/admin";
import { getIceServers } from "./server/ice";
import { startPhrasebookSchedule } from "./server/phrasebook";
import { noteSeat, notifyWaiting, pushKey, pushSubscribe, pushUnsubscribe, readBody } from "./server/push";
import { getRoom } from "./server/rooms";
import { append, device } from "./server/store";

/** Client events kept on disk to diagnose dropped calls: connection health only. */
const CONN_EVENTS = new Set(["ice_connected", "ice_failed", "connect_timeout", "heal", "signal_failed", "offer_failed", "weak_network", "socket_back", "away", "back", "reconnected", "gave_up"]);
import { log } from "./server/log";
import { refineConfigured } from "./server/refine";
import { broadcast, createRoom, disconnect, ensureRoom, info, others, removePeer, seat, send, reportLine, setCaptionStyle, typedText, setInRoom, speakerAudio, stopSpeaking, type Peer, type Room } from "./server/rooms";
import { sonioxConfigured } from "./server/soniox";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, hostname: "0.0.0.0", port });
const handle = app.getRequestHandler();

function json(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

await app.prepare();

startPhrasebookSchedule();

const server = createServer((req, res) => {
  const url = parse(req.url ?? "/", true);
  const path = url.pathname ?? "/";
  if (path === "/healthz") return json(res, 200, { ok: true });
  if (path === "/api/feedback" && req.method === "POST") return void feedback(req, res);
  if (path === "/api/client-error" && req.method === "POST") return void clientError(req, res);
  if (path === "/admin" && req.method === "GET") return dashboard(typeof url.query.token === "string" ? url.query.token : undefined, res);
  if (path === "/api/push/key" && req.method === "GET") return pushKey(res);
  if (path === "/api/leave" && req.method === "POST") return void leaveBeacon(req, res);
  if (path === "/api/active" && req.method === "POST") return void markActive(req, res);
  if (path === "/api/waiting" && req.method === "GET") return presence(typeof url.query.codes === "string" ? url.query.codes : "", res);
  if (path === "/api/push/subscribe" && req.method === "POST") return void pushSubscribe(req, res);
  if (path === "/api/push/unsubscribe" && req.method === "POST") return void pushUnsubscribe(req, res);
  if (path === "/api/rooms" && req.method === "POST") {
    const kind = url.query.kind === "group" ? "group" : "pair";
    const room = createRoom(kind);
    return room ? json(res, 201, { code: room.code, kind: room.kind, max: room.max }) : json(res, 503, { error: "busy" });
  }
  const m = path.match(/^\/api\/rooms\/([a-z0-9]{6}|[a-z0-9]{10})$/i);
  if (m && req.method === "GET") {
    const room = ensureRoom(m[1]);
    return json(res, room ? 200 : 404, room ? { code: room.code, peers: room.peers.size, kind: room.kind, max: room.max } : { error: "not-found" });
  }
  handle(req, res, url);
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
const nextUpgrade = app.getUpgradeHandler();
server.on("upgrade", (req, socket, head) => {
  if (parse(req.url ?? "").pathname === "/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  } else {
    nextUpgrade(req, socket, head); // dev HMR
  }
});

const alive = new WeakSet<WebSocket>();
setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.has(ws)) {
      ws.terminate();
      continue;
    }
    alive.delete(ws);
    ws.ping();
  }
}, 20_000).unref();

wss.on("connection", (ws, req) => {
  alive.add(ws);
  const devName = device(req.headers["user-agent"]);
  ws.on("pong", () => alive.add(ws));
  let room: Room | undefined;
  let peer: Peer | undefined;

  ws.on("message", async (data, isBinary) => {
    if (isBinary) {
      const buf = data as Buffer;
      if (peer && room?.peers.get(peer.id) === peer && buf.length > 1) speakerAudio(room, peer, buf[0] - 120, buf.subarray(1));
      return;
    }
    let msg: ClientMsg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.t === "ping") return send(ws, { t: "pong" });

    if (msg.t === "join") {
      const lang = sanitizeLang(msg.lang);
      if (typeof msg.room !== "string" || typeof msg.peerId !== "string" || !/^[\w-]{8,64}$/.test(msg.peerId) || !lang) {
        return send(ws, { t: "error", code: "bad-request" });
      }
      room = ensureRoom(msg.room);
      if (!room) return send(ws, { t: "error", code: "room-not-found" });
      const result = seat(room, msg.peerId, lang, ws, { name: msg.name, inRoom: msg.inRoom, device: devName, captionStyle: msg.captionStyle, gender: msg.gender, profile: msg.profile });
      if (result === "room-full") return send(ws, { t: "error", code: "room-full" });
      peer = result.peer;
      const rest = others(room, peer);
      send(ws, {
        t: "joined",
        selfId: peer.id,
        fresh: result.fresh,
        kind: room.kind,
        max: room.max,
        peers: rest.map(info),
        iceServers: await getIceServers(),
      });
      if (!sonioxConfigured()) {
        send(ws, { t: "captions", state: "unavailable", side: "theirs" });
        send(ws, { t: "captions", state: "unavailable", side: "mine" });
      }
      // Everyone already here offers a connection to a newcomer.
      if (result.fresh) broadcast(room, { t: "peer-joined", peer: info(peer), offer: true }, peer);
      // Call cards: remember who has been here (only they may follow it), and tell the phones
      // that follow this card that someone is waiting.
      if (room.kind === "pair") noteSeat(room.code, peer.id);
      if (result.fresh && room.kind === "pair") notifyWaiting(room.code, peer.name, peer.id, new Set([...room.peers.values()].filter((p) => p.ws).map((p) => p.id)));
      log("peer_joined", { room: room.code, kind: room.kind, peer: peer.label, fresh: result.fresh, speaks: lang.speaks, reads: lang.reads, inRoom: peer.inRoom, others: rest.length });
      return;
    }

    if (!room || !peer || room.peers.get(peer.id) !== peer || peer.ws !== ws) return;
    switch (msg.t) {
      case "need-offer": {
        const targets = msg.to ? others(room, peer).filter((o) => o.id === msg.to) : others(room, peer);
        for (const o of targets) send(o.ws, { t: "peer-joined", peer: info(peer), offer: true });
        break;
      }
      case "signal": {
        const to = typeof msg.to === "string" ? room.peers.get(msg.to) : undefined;
        if (to && to !== peer) send(to.ws, { t: "signal", from: peer.id, data: msg.data });
        break;
      }
      case "speech":
        if (!msg.on) stopSpeaking(room, peer);
        break;
      case "set-in-room":
        setInRoom(room, peer, !!msg.inRoom);
        break;
      case "set-caption-style":
        setCaptionStyle(peer, msg.style);
        break;
      case "report":
        reportLine(room, peer, msg.id);
        break;
      case "typed":
        typedText(room, peer, msg.text);
        break;
      case "log": {
        const event = String(msg.event).slice(0, 40);
        const detail = { room: room.code, peer: peer.label, ...(msg.detail ?? {}) };
        log(`client_${event}`, detail);
        // Connection health is kept (no words, no media) to find out why calls drop.
        if (CONN_EVENTS.has(event)) append("conn", { event, device: devName, ...detail });
        break;
      }
      case "leave":
        removePeer(room, peer, "left");
        break;
    }
  });

  ws.on("close", () => {
    if (room && peer) disconnect(room, peer, ws);
  });
});

server.listen(port, () => {
  log("listening", { port, dev, soniox: sonioxConfigured(), refine: refineConfigured() });
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    log("shutdown", { sig });
    for (const ws of wss.clients) ws.close(1012, "restart");
    server.close();
    setTimeout(() => process.exit(0), 500).unref();
  });
}

/**
 * POST /api/leave {room, peerId}: the same as a "leave" over the socket, sent with sendBeacon
 * when someone hangs up or leaves the page, so it arrives even if the socket is dead. The seat
 * id is a random secret only that phone knows.
 */
async function leaveBeacon(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) {
  const b = (await readBody(req, 2048)) as { room?: unknown; peerId?: unknown } | null;
  if (typeof b?.room === "string" && typeof b.peerId === "string" && /^[\w-]{8,64}$/.test(b.peerId)) {
    const room = getRoom(b.room);
    const peer = room?.peers.get(b.peerId);
    if (room && peer) removePeer(room, peer, "left");
  }
  res.writeHead(204);
  res.end();
}

/**
 * "Active now": phones with Simpatico open on the home screen say so every 20 s, for the
 * private rooms they share with people (lib/pair.ts). Kept in memory for 45 s, never stored.
 */
const active = new Map<string, Map<string, { name: string; at: number }>>();
const ACTIVE_MS = 45_000;
const CODE = /^[a-z0-9]{10}$/;
const SEAT_ID = /^[\w-]{8,64}$/;

/** POST /api/active { name, rooms: [{code, seat}], gone?: true } */
async function markActive(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) {
  const b = (await readBody(req, 8192)) as { name?: unknown; rooms?: unknown; gone?: unknown } | null;
  const name = typeof b?.name === "string" ? b.name.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40) : "";
  const rooms = Array.isArray(b?.rooms) ? (b.rooms as { code?: unknown; seat?: unknown }[]).slice(0, 50) : [];
  const now = Date.now();
  for (const r of rooms) {
    if (typeof r?.code !== "string" || !CODE.test(r.code) || typeof r.seat !== "string" || !SEAT_ID.test(r.seat)) continue;
    let m = active.get(r.code);
    if (b?.gone === true) {
      m?.delete(r.seat);
      continue;
    }
    if (!name) continue;
    if (!m) active.set(r.code, (m = new Map()));
    m.set(r.seat, { name, at: now });
  }
  if (active.size > 50_000) for (const [c, m] of active) if (![...m.values()].some((x) => now - x.at < ACTIVE_MS)) active.delete(c);
  res.writeHead(204);
  res.end();
}

/**
 * GET /api/waiting?codes=code:seat,... — for each room code this phone holds: who is sitting in
 * that room now ("waiting"), and who else has the app open for it ("active"). The seat says
 * which one is me, so I'm not listed. Never opens a room.
 */
function presence(codes: string, res: import("node:http").ServerResponse) {
  const waiting: Record<string, string[]> = {};
  const here: Record<string, string[]> = {};
  const now = Date.now();
  for (const item of codes.split(",").slice(0, 50)) {
    const [code, seat] = item.split(":");
    if (!CODE.test(code ?? "")) continue;
    const room = getRoom(code);
    const inRoom = room ? [...room.peers.values()].filter((p) => p.ws && p.id !== seat).map((p) => p.name) : [];
    if (inRoom.length) waiting[code] = inRoom;
    const on = [...(active.get(code)?.entries() ?? [])].filter(([s, x]) => s !== seat && now - x.at < ACTIVE_MS).map(([, x]) => x.name);
    if (on.length) here[code] = on;
  }
  return json(res, 200, { waiting, active: here });
}
