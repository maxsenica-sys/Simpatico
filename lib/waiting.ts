"use client";
import { useEffect, useState } from "react";
import { myCallCode } from "./profile";
import { samePerson, type RecentPerson } from "./recent";

export type Waiting = { name: string; room: string; person: RecentPerson | null };

/**
 * "Waiting now": who is sitting in my call card room, or in a call card room I've talked in
 * before, right now. Checked every 8 s while the home screen is on screen (cheap: a tiny
 * request, and only for the codes this phone already holds).
 */
export function useWaiting(recent: RecentPerson[], me: string): Waiting[] {
  const [waiting, setWaiting] = useState<Waiting[]>([]);
  const rooms = [...new Set(recent.map((r) => r.room).filter((r): r is string => !!r))].join(",");
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const mine = myCallCode();
    const check = async () => {
      if (document.visibilityState === "visible") {
        try {
          const codes = [mine, ...rooms.split(",").filter(Boolean)].slice(0, 20).join(",");
          const r = await fetch(`/api/waiting?codes=${codes}`, { cache: "no-store" });
          const { waiting: w } = (await r.json()) as { waiting: Record<string, string[]> };
          const out: Waiting[] = [];
          for (const [room, names] of Object.entries(w)) {
            for (const name of names) {
              if (me && samePerson(name, me)) continue; // me, on another phone
              const person = recent.find((p) => samePerson(p.name, name)) ?? null;
              // In someone else's card: only the people we talked to there count.
              if (room !== mine && !(person && person.room === room)) continue;
              if (!out.some((x) => samePerson(x.name, name))) out.push({ name, room, person });
            }
          }
          if (live) setWaiting(out);
        } catch {}
      }
      if (live) timer = setTimeout(check, 8_000);
    };
    void check();
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (timer) clearTimeout(timer);
      void check();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, me]);
  return waiting;
}
