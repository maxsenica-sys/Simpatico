"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MicCapture } from "@/lib/audio";
import type { Caption } from "@/lib/call";
import { useT } from "@/lib/i18n";
import { getMicTrack } from "@/lib/media";
import { loadLang } from "@/lib/prefs";
import { loadProfile } from "@/lib/profile";
import { ScreenAwake } from "@/lib/wakeLock";
import { en, loadStrings, type StringKey, type Strings } from "@/i18n";
import { baseLang, isRtl, langInfo } from "@/shared/lang";
import { LANGUAGES } from "@/shared/languages";
import type { CaptionState, InPersonServerMsg } from "@/shared/protocol";
import { CaptionBox } from "./CaptionBox";
import { LanguageLine } from "./LanguageLine";
import { Logo } from "./Logo";

/** Languages people most often need face to face; the rest are under "More". */
const COMMON = ["es", "zh", "ar", "hi", "fr", "pt", "ru", "ja", "ko", "de", "it", "tr", "id", "vi", "th", "en"];
const SORTED = [...LANGUAGES].sort((a, b) => a.name.localeCompare(b.name));
const SIZES = ["clamp(20px, 5.4vw, 28px)", "clamp(25px, 6.6vw, 34px)", "clamp(30px, 8vw, 42px)"];

type Own = { id: string; text: string; final: boolean; at: number } | null;

/** Same rules as a call (lib/call.ts): settled lines never change; kept 30 s. */
function applyCaption(list: Caption[], m: Extract<InPersonServerMsg, { t: "cap" }>): Caption[] {
  const now = Date.now();
  const out = list.filter((c) => c.doneAt === null || now - c.doneAt < 30_000);
  const i = out.findIndex((c) => c.id === m.id);
  const done = m.stage === "final" || m.stage === "refined";
  if (i >= 0) {
    if (out[i].doneAt !== null) return out;
    out[i] = { ...out[i], text: m.text, tail: m.tail, stage: m.stage, updatedAt: now, doneAt: done ? now : null };
  } else if (m.text || m.tail) out.push({ id: m.id, from: "x", text: m.text, tail: m.tail, stage: m.stage, updatedAt: now, doneAt: done ? now : null });
  return out.filter((c) => c.text || c.tail);
}

/**
 * In person: one phone between two people who don't share a language. The bottom half is
 * yours, the top half is upside down for them (in their language). Nobody taps anything: one
 * microphone hears both, each sentence is recognised by its language and translated for the
 * other person while it's still being said. See server/inperson.ts.
 */
export function InPerson() {
  const t = useT();
  const router = useRouter();
  const [mine, setMine] = useState("en");
  const [theirs, setTheirs] = useState<string | null>(null);
  const [detect, setDetect] = useState(true);
  const [phase, setPhase] = useState<"setup" | "starting" | "live">("setup");
  const [error, setError] = useState<"mic" | "unavailable" | null>(null);

  useEffect(() => setMine(loadLang().speaks), []);
  const myBase = baseLang(mine);
  const choices = COMMON.filter((c) => c !== myBase);

  if (phase !== "live" || !session.current)
    return (
      <main className="screen ip-setup">
        <header className="join-head">
          <Link href="/" className="round-btn join-back" aria-label={t("backHome")}>
            ‹
          </Link>
          <Logo small />
        </header>
        <h1>{t("ipHeading")}</h1>
        <p className="muted">{t("ipIntro")}</p>
        <button className={`ip-choice ${detect ? "on" : ""}`} onClick={() => setDetect(true)} aria-pressed={detect}>
          <b>{t("ipDetect")}</b>
          <small>{t("ipDetectSub")}</small>
        </button>
        <div className={`ip-choice ${!detect ? "on" : ""}`}>
          <b>{t("ipPick")}</b>
          <div className="ip-chips">
            {choices.slice(0, 9).map((c) => (
              <button
                key={c}
                className={`chip ${!detect && baseLang(theirs) === c ? "on" : ""}`}
                onClick={() => {
                  setTheirs(c);
                  setDetect(false);
                }}
              >
                {langInfo(c).native}
              </button>
            ))}
          </div>
          <select
            className="ip-more"
            aria-label={t("ipMore")}
            value={!detect && theirs && !choices.slice(0, 9).includes(baseLang(theirs)!) ? baseLang(theirs)! : ""}
            onChange={(e) => {
              if (!e.target.value) return;
              setTheirs(e.target.value);
              setDetect(false);
            }}
          >
            <option value="">{t("ipMore")}</option>
            {SORTED.filter((l) => l.code !== myBase).map((l) => (
              <option key={l.code} value={l.code}>
                {l.native} · {l.name}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p className="field-error" role="alert">
            {t(error === "mic" ? "ipMicBlocked" : "ipUnavailable")}
          </p>
        )}
        <button
          className="btn primary big"
          disabled={phase === "starting" || (!detect && !theirs)}
          onClick={async () => {
            setError(null);
            setPhase("starting");
            const s = new Session(mine, detect ? null : theirs, () => setPhase("live"));
            session.current = s;
            const r = await s.start();
            if (r) {
              session.current = null;
              setError(r);
              setPhase("setup");
            }
          }}
        >
          {phase === "starting" ? t("starting") : t("ipStart")}
        </button>
        <LanguageLine />
      </main>
    );

  return <Live session={session.current} onEnd={() => router.push("/")} />;
}

/** The running conversation: the connection, the microphone and what's on each half. */
class Session {
  ws: WebSocket | null = null;
  mic: MicCapture | null = null;
  track: MediaStreamTrack | null = null;
  awake = new ScreenAwake();
  ended = false;
  retries = 0;
  listeners = new Set<() => void>();
  forMe: Caption[] = [];
  forThem: Caption[] = [];
  ownMe: Own = null;
  ownThem: Own = null;
  status: CaptionState = "ok";

  constructor(
    public mine: string,
    public theirs: string | null,
    private onLive: () => void,
  ) {}

  private changed() {
    for (const f of this.listeners) f();
  }

  /** Inside the Start tap (iOS only lets audio start from a tap). Null when it's running. */
  async start(): Promise<"mic" | "unavailable" | null> {
    try {
      this.track = await getMicTrack();
    } catch {
      return "mic";
    }
    this.mic = new MicCapture(
      this.track,
      (pcm, db) => this.sendAudio(pcm, db),
      (on) => {
        if (!on) this.send({ t: "speech", on: false });
      },
    );
    // Both people count: the one across the table is further from the mic (voice focus, on in
    // calls, would take them for someone in the background).
    this.mic.focus = false;
    try {
      await this.mic.start();
    } catch {
      return "mic";
    }
    this.awake.on();
    return await new Promise((resolve) => this.connect(resolve));
  }

  private connect(first?: (r: "unavailable" | null) => void) {
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/inperson`);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.onopen = () => {
      const p = loadProfile();
      this.send({ t: "start", mine: this.mine, theirs: this.theirs, names: p.name ? [p.name] : [], words: p.words ?? [] });
    };
    ws.onmessage = (e) => {
      let m: InPersonServerMsg;
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (m.t === "ready") {
        this.retries = 0;
        first?.(null);
        first = undefined;
        this.onLive();
      } else if (m.t === "error") {
        first?.("unavailable");
        first = undefined;
      } else if (m.t === "lang") this.theirs = m.theirs;
      else if (m.t === "status") this.status = m.state;
      else if (m.t === "cap") {
        if (m.for === "me") this.forMe = applyCaption(this.forMe, m);
        else this.forThem = applyCaption(this.forThem, m);
      } else if (m.t === "own") {
        const line = { id: m.id, text: m.text, final: m.final, at: Date.now() };
        if (m.by === "me") this.ownMe = line;
        else this.ownThem = line;
      }
      this.changed();
    };
    ws.onclose = () => {
      if (this.ended) return;
      if (first) {
        first("unavailable");
        first = undefined;
        return;
      }
      // Dropped (tunnel, lift, bad signal): come back on our own.
      this.status = "paused";
      this.changed();
      setTimeout(() => !this.ended && this.connect(), Math.min(5000, 500 * 2 ** this.retries++));
    };
  }

  send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private sendAudio(pcm: ArrayBuffer, db: number) {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > 64_000) return;
    const frame = new Uint8Array(pcm.byteLength + 1);
    frame[0] = Math.max(0, Math.min(255, Math.round(db + 120)));
    frame.set(new Uint8Array(pcm), 1);
    ws.send(frame);
  }

  setTheirs(lang: string) {
    this.theirs = lang;
    this.send({ t: "theirs", lang });
    this.changed();
  }

  end() {
    this.ended = true;
    this.send({ t: "end" });
    this.ws?.close();
    this.track?.stop();
    this.awake.off();
  }
}

const session = { current: null as Session | null };

function Live({ session: s, onEnd }: { session: Session; onEnd: () => void }) {
  const t = useT();
  const [, setTick] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [size, setSize] = useState(1);
  const [picking, setPicking] = useState(false);
  const [them, setThem] = useState<Strings>(en);
  useEffect(() => {
    const f = () => setTick((n) => n + 1);
    s.listeners.add(f);
    return () => {
      s.listeners.delete(f);
    };
  }, [s]);
  useEffect(() => () => s.end(), [s]);
  // Their half speaks their language (when the app has it; English otherwise).
  const theirUi = baseLang(s.theirs);
  useEffect(() => {
    let live = true;
    if (theirUi) loadStrings(theirUi).then((x) => live && setThem(x));
    return () => {
      live = false;
    };
  }, [theirUi]);
  const tt = (key: StringKey, vars?: Record<string, string>) => (them[key] ?? en[key]).replace(/\{(\w+)\}/g, (_, k: string) => vars?.[k] ?? "");

  const theyTalk = !!s.ownThem && !s.ownThem.final;
  const iTalk = !!s.ownMe && !s.ownMe.final;
  const theirName = s.theirs ? langInfo(s.theirs).native : null;

  return (
    <main className={`ip-live ${flipped ? "flipped" : ""}`} style={{ ["--cap-size" as string]: SIZES[size] }}>
      <section className="ip-half them" lang={s.theirs ?? undefined} dir={s.theirs && isRtl(s.theirs) ? "rtl" : "ltr"}>
        <div className="ip-head">
          <span>{tt("ipForYou")}</span>
          {iTalk ? <span className="ip-talking">{tt("ipTalking")}</span> : null}
        </div>
        <div className="ip-caps">
          {s.forThem.length ? (
            <CaptionBox captions={s.forThem} names={null} lang={s.theirs ?? undefined} speaking={iTalk} />
          ) : (
            <p className="ip-empty">{tt("ipThemHint")}</p>
          )}
        </div>
        {s.ownThem && (
          <div className="ip-own">
            <i>{tt("ipYouSaid")}</i>
            {s.ownThem.text}
          </div>
        )}
      </section>

      <nav className="ip-mid">
        <button className="pill" onClick={() => setPicking(true)}>
          {theirName ? t("ipTheySpeak", { lang: theirName }) : t("ipListening")}
        </button>
        <button className="pill" onClick={() => setFlipped((f) => !f)} aria-label={t("ipFlip")}>
          ⇅ {t("ipFlip")}
        </button>
        <button className="pill" onClick={() => setSize((n) => (n + 1) % SIZES.length)} aria-label={t("ipSize")}>
          Aa
        </button>
        <button
          className="pill end"
          onClick={() => {
            s.end();
            onEnd();
          }}
        >
          {t("ipEnd")}
        </button>
      </nav>

      <section className="ip-half me">
        <div className="ip-head">
          <span>{t("ipForYou")}</span>
          {theyTalk ? <span className="ip-talking">{t("ipTalking")}</span> : s.status !== "ok" ? <span className="ip-status">{t(s.status === "paused" ? "captionsPaused" : "captionsUnavailable")}</span> : null}
        </div>
        <div className="ip-caps">
          {s.forMe.length ? (
            <CaptionBox captions={s.forMe} names={null} lang={s.mine} speaking={theyTalk} />
          ) : (
            <p className="ip-empty">{s.theirs ? t("ipStartTalking") : t("ipListening")}</p>
          )}
        </div>
        {s.ownMe && (
          <div className="ip-own">
            <i>{t("ipYouSaid")}</i>
            {s.ownMe.text}
          </div>
        )}
      </section>

      {picking && (
        <div className="bsheet-backdrop" onClick={() => setPicking(false)}>
          <div className="bsheet" onClick={(e) => e.stopPropagation()}>
            <div className="bsheet-handle" />
            <h2>{t("ipPick")}</h2>
            <select
              className="ip-more"
              autoFocus
              value={baseLang(s.theirs) ?? ""}
              onChange={(e) => {
                if (e.target.value) s.setTheirs(e.target.value);
                setPicking(false);
              }}
            >
              <option value="">{t("ipMore")}</option>
              {SORTED.filter((l) => l.code !== baseLang(s.mine)).map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native} · {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </main>
  );
}

