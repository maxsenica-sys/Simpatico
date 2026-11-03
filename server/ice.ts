import { log } from "./log";

const STUN: RTCIceServer[] = [
  { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] },
];

let cached: { servers: RTCIceServer[]; until: number } | null = null;

/**
 * Public STUN by default. If CF_TURN_KEY_ID + CF_TURN_API_TOKEN are set, short-lived
 * Cloudflare Realtime TURN credentials are added (the brief's fallback for calls that fail to connect).
 */
export async function getIceServers(): Promise<RTCIceServer[]> {
  const keyId = process.env.CF_TURN_KEY_ID;
  const token = process.env.CF_TURN_API_TOKEN;
  if (!keyId || !token) return STUN;
  if (cached && cached.until > Date.now()) return cached.servers;
  try {
    const ttl = 6 * 3600;
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl }),
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { iceServers: RTCIceServer | RTCIceServer[] };
    const turn = Array.isArray(body.iceServers) ? body.iceServers : [body.iceServers];
    const servers = [...STUN, ...turn];
    cached = { servers, until: Date.now() + (ttl - 3600) * 1000 };
    return servers;
  } catch (err) {
    log("turn_credentials_failed", { error: String(err) });
    return STUN;
  }
}
