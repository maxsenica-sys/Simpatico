"use client";
/**
 * "Tell me when someone's waiting" (call cards only). On by default: the phone is asked once,
 * from the first Join tap (phones only allow the question from a tap), and the setting can be
 * turned off on the Me page. iPhones only allow this once Simpatico is on the Home Screen.
 */
import { myCallCode } from "./profile";
import { peerIdFor } from "./prefs";

const OFF_KEY = "talk.notify";

export function notifyEnabled(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function pushPermission(): NotificationPermission | "unsupported" {
  return pushSupported() ? Notification.permission : "unsupported";
}

function b64ToBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Follow call cards: always my own, plus `extra` (a call card I'm joining). With `ask`, call it
 * straight from a tap: the phone's permission question must come from one.
 */
export async function followCards(text: string, opts: { ask: boolean; extra?: string | string[] }) {
  if (!pushSupported() || !notifyEnabled()) return;
  try {
    if (Notification.permission === "default") {
      if (!opts.ask) return;
      if ((await Notification.requestPermission()) !== "granted") return;
    }
    if (Notification.permission !== "granted") return;
    const rooms: Record<string, { seat: string; own: boolean }> = {};
    const mine = myCallCode();
    rooms[mine] = { seat: peerIdFor(mine), own: true };
    for (const code of [opts.extra ?? []].flat())
      if (code !== mine && /^[a-z0-9]{10}$/.test(code)) rooms[code] = { seat: peerIdFor(code), own: false };
    await navigator.serviceWorker.register("/sw.js");
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const r = await fetch("/api/push/key");
      if (!r.ok) return;
      const { key } = (await r.json()) as { key: string };
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) as BufferSource });
    }
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), rooms, text }),
    });
  } catch {}
}

/** The Me page switch. Turning it on asks the phone (from that tap) if it hasn't been asked. */
export async function setNotify(on: boolean, text: string) {
  try {
    localStorage.setItem(OFF_KEY, on ? "on" : "off");
  } catch {}
  if (on) return followCards(text, { ask: true });
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    await sub.unsubscribe();
  } catch {}
}

/** "Clear my profile": the server forgets this phone's notification address and cards. */
export async function forgetPush() {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    await sub.unsubscribe();
  } catch {}
}
