"use client";
import { useEffect, useState } from "react";
import { peerIdFor } from "./prefs";
import { myCallCode } from "./profile";
import { samePerson, type RecentPerson } from "./recent";

export type Waiting = { name: string; room: string; person: RecentPerson | null };
export type Presence = { waiting: Waiting[]; active: RecentPerson[] };

const CHECK_MS = 8_000;
const ACTIVE_MS = 20_000;

/**
 * While the home screen is open:
 *  - "Active now": tell the people I share a private room with (lib/pair.ts) that I have the
 *    app open, and find out which of them do;
 *  - "Waiting now": who is sitting in my call card room, a card room I've talked in, or one of
 *    our private rooms, right now.
 * Only room codes this phone already holds are asked about; nothing is stored on the server.
 */
export function usePresence(recent: RecentPerson[], me: string): Presence {
  const [state, setState] = useState<Presence>({ waiting: [], active: [] });
  const sig = recent.map((r) => `${r.name}|${r.room ?? ""}|${r.pair ?? ""}`).join(",");
  useEffect(() => {
    let live = true;
    let checkTimer: ReturnType<typeof setTimeout> | null = null;
    let activeTimer: ReturnType<typeof setInterval> | null = null;
    const mine = myCallCode();
    const pairs = recent.filter((r) => r.pair).map((r) => ({ code: r.pair!, seat: peerIdFor(r.pair!) }));
    const cards = [...new Set(recent.map((r) => r.room).filter((r): r is string => !!r && r !== mine))];
    const query = [`${mine}:${peerIdFor(mine)}`, ...cards.map((c) => `${c}:${peerIdFor(c)}`), ...pairs.map((p) => `${p.code}:${p.seat}`)].slice(0, 50).join(",");

    const sayActive = (gone = false) => {
      if (!pairs.length || (!me && !gone)) return;
      const body = JSON.stringify({ name: me, rooms: pairs, gone: gone || undefined });
      try {
        if (gone && navigator.sendBeacon?.("/api/active", new Blob([body], { type: "application/json" }))) return;
        void fetch("/api/active", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: gone }).catch(() => {});
      } catch {}
    };

    const check = async () => {
      if (document.visibilityState === "visible") {
        try {
          const r = await fetch(`/api/waiting?codes=${query}`, { cache: "no-store" });
          const res = (await r.json()) as { waiting: Record<string, string[]>; active?: Record<string, string[]> };
          const waiting: Waiting[] = [];
          for (const [room, names] of Object.entries(res.waiting)) {
            const pairPerson = recent.find((p) => p.pair === room) ?? null;
            for (const name of names) {
              if (me && samePerson(name, me) && room !== pairPerson?.pair) continue; // me, on another phone
              const person = pairPerson ?? recent.find((p) => samePerson(p.name, name)) ?? null;
              // Someone else's card: only the person we talked to there counts.
              if (room !== mine && !pairPerson && !(person && person.room === room)) continue;
              if (!waiting.some((x) => x.person ? x.person === person : samePerson(x.name, name))) waiting.push({ name: person?.name ?? name, room, person });
            }
          }
          const active = recent.filter((p) => p.pair && res.active?.[p.pair]?.length);
          if (live) setState({ waiting, active });
        } catch {}
      }
      if (live) checkTimer = setTimeout(check, CHECK_MS);
    };

    const start = () => {
      sayActive();
      if (activeTimer) clearInterval(activeTimer);
      activeTimer = setInterval(() => document.visibilityState === "visible" && sayActive(), ACTIVE_MS);
      if (checkTimer) clearTimeout(checkTimer);
      void check();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") start();
      else sayActive(true);
    };
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      live = false;
      if (checkTimer) clearTimeout(checkTimer);
      if (activeTimer) clearInterval(activeTimer);
      document.removeEventListener("visibilitychange", onVis);
      sayActive(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, me]);
  return state;
}
