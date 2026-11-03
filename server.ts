import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { WebSocketServer, type WebSocket } from "ws";
import { sanitizeLang } from "./shared/lang";
import type { ClientMsg } from "./shared/protocol";
import { getIceServers } from "./server/ice";
import { log } from "./server/log";
import { refineConfigured } from "./server/refine";
import { createRoom, disconnect, getRoom, partnerOf, removePeer, seat, send, type Peer, type Room } from "./server/rooms";
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

const server = createServer((req, res) => {
  const url = parse(req.url ?? "/", true);
  const path = url.pathname ?? "/";
  if (path === "/healthz") return json(res, 200, { ok: true });
  if (path === "/api/rooms" && req.method === "POST") {
    const room = createRoom();
    return room ? json(res, 201, { code: room.code }) : json(res, 503, { error: "busy" });
  }
  const m = path.match(/^\/api\/rooms\/([a-z0-9]{6})$/i);
  if (m && req.method === "GET") {
    const room = getRoom(m[1]);
    return json(res, room ? 200 : 404, room ? { code: room.code, peers: room.peers.size } : { error: "not-found" });
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

wss.on("connection", (ws) => {
  alive.add(ws);
  ws.on("pong", () => alive.add(ws));
  let room: Room | undefined;
  let peer: Peer | undefined;

  ws.on("message", async (data, isBinary) => {
    if (isBinary) {
      if (peer && room?.peers.get(peer.id) === peer) peer.pipeline.audio(data as Buffer);
      return;
    }
    let msg: ClientMsg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.t === "join") {
      const lang = sanitizeLang(msg.lang);
      if (typeof msg.room !== "string" || typeof msg.peerId !== "string" || !/^[\w-]{8,64}$/.test(msg.peerId) || !lang) {
        return send(ws, { t: "error", code: "bad-request" });
      }
      room = getRoom(msg.room);
      if (!room) return send(ws, { t: "error", code: "room-not-found" });
      const result = seat(room, msg.peerId, lang, ws);
      if (result === "room-full") return send(ws, { t: "error", code: "room-full" });
      peer = result.peer;
      const partner = partnerOf(room, peer);
      send(ws, { t: "joined", selfId: peer.id, fresh: result.fresh, partner: partner?.lang ?? null, iceServers: await getIceServers() });
      if (!sonioxConfigured()) send(ws, { t: "captions", state: "unavailable" });
      if (result.fresh && partner) send(partner.ws, { t: "peer-joined", partner: peer.lang, offer: true });
      log("peer_joined", { room: room.code, peer: peer.label, fresh: result.fresh, speaks: lang.speaks, reads: lang.reads, partner: !!partner });
      return;
    }

    if (!room || !peer || room.peers.get(peer.id) !== peer || peer.ws !== ws) return;
    const partner = partnerOf(room, peer);
    switch (msg.t) {
      case "need-offer":
        send(partner?.ws, { t: "peer-joined", partner: peer.lang, offer: true });
        break;
      case "signal":
        send(partner?.ws, { t: "signal", data: msg.data });
        break;
      case "speech":
        if (!msg.on) peer.pipeline.speechEnded();
        break;
      case "log":
        log(`client_${String(msg.event).slice(0, 40)}`, { room: room.code, peer: peer.label, ...(msg.detail ?? {}) });
        break;
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
