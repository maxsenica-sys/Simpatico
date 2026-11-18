"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { loadProfile, myCallCode } from "@/lib/profile";
import { loadRecent, samePerson, type RecentPerson } from "@/lib/recent";
import { usePresence } from "@/lib/waiting";
import { LinkSheet } from "./LinkSheet";
import { PersonSheet, RecentRow } from "./Recent";

/**
 * Contacts: everyone you've had a call with (kept on this phone only), A to Z, with search.
 * Tap to call, hold for details. "Add" shares your call card: whoever opens it and talks to
 * you appears here.
 */
export function Contacts() {
  const t = useT();
  const router = useRouter();
  const [people, setPeople] = useState<RecentPerson[]>([]);
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [myLink, setMyLink] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(false);
  const [person, setPerson] = useState<{ p: RecentPerson; color: string } | null>(null);
  useEffect(() => {
    setPeople(loadRecent());
    setName(loadProfile().name);
    setMyLink(`${location.origin}/r/${myCallCode()}`);
  }, []);
  const { waiting, active } = usePresence(people, name);
  const shown = people
    .filter((p) => p.name.toLocaleLowerCase().includes(q.trim().toLocaleLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="screen contacts">
      <header className="profile-head">
        <Link href="/" className="round-btn" aria-label={t("backHome")}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1>{t("contactsTitle")}</h1>
        <button className="link contacts-add" onClick={() => setShowLink(true)} disabled={!myLink}>
          {t("contactsAdd")}
        </button>
      </header>
      {people.length > 5 && <input className="contacts-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("contactsSearch")} aria-label={t("contactsSearch")} autoComplete="off" />}
      {people.length === 0 ? (
        <p className="muted contacts-empty">{t("contactsEmpty")}</p>
      ) : (
        <RecentRow
          people={shown}
          waiting={waiting}
          active={active}
          title={`${t("allContacts")} · ${people.length}`}
          max={Infinity}
          showLang
          onPick={(p, color) => {
            const w = waiting.find((x) => x.person && samePerson(x.person.name, p.name));
            if (w) router.push(`/r/${w.room}`);
            else if (p.pair) router.push(`/r/${p.pair}`);
            else setPerson({ p, color });
          }}
          onDetails={(p, color) => setPerson({ p, color })}
        />
      )}
      {person && myLink && (
        <PersonSheet
          person={person.p}
          color={person.color}
          link={myLink}
          onClose={() => setPerson(null)}
          onCalling={() => router.push(person.p.pair ? `/r/${person.p.pair}` : new URL(myLink).pathname)}
          onRemoved={() => {
            setPerson(null);
            setPeople(loadRecent());
          }}
        />
      )}
      {showLink && myLink && <LinkSheet url={myLink} onClose={() => setShowLink(false)} onOpen={() => router.push(new URL(myLink).pathname)} />}
    </main>
  );
}
