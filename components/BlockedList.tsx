"use client";
import { useEffect, useState } from "react";
import { loadBlocked, unblockPerson, type Blocked } from "@/lib/blocks";
import { useT } from "@/lib/i18n";

/** Me page: the people you've blocked, each with Unblock. Hidden when there's nobody. */
export function BlockedList() {
  const t = useT();
  const [list, setList] = useState<Blocked[]>([]);
  useEffect(() => setList(loadBlocked()), []);
  if (!list.length) return null;
  return (
    <section className="pcard">
      <h2>{t("blockedTitle")}</h2>
      <ul className="blocked-list">
        {list.map((b) => (
          <li key={b.name}>
            <span>{b.name}</span>
            <button
              className="btn small"
              onClick={async () => {
                await unblockPerson(b.name);
                setList(loadBlocked());
              }}
            >
              {t("unblock")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
