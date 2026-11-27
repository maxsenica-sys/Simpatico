"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MicCapture } from "@/lib/audio";
import type { Caption } from "@/lib/call";
import { useT } from "@/lib/i18n";
import { getMicTrack } from "@/lib/media";
import { loadLang } from "@/lib/prefs";
import { loadProfile } from "@/lib/profile";
import { loadRecent } from "@/lib/recent";
import { RECOVERY_DAYS, keepsTalks, setKeepTalks, stashTalk, talkText, type SavedTalk } from "@/lib/saved";
import { saveTranscript } from "@/lib/transcriptFile";
import { ScreenAwake } from "@/lib/wakeLock";
import { en, loadStrings, type StringKey, type Strings } from "@/i18n";
import { baseLang, isRtl, langInfo } from "@/shared/lang";
import { LANGUAGES } from "@/shared/languages";
import type { CaptionState, InPersonServerMsg } from "@/shared/protocol";
import { CaptionBox } from "./CaptionBox";
import { KeepSign } from "./KeepSign";
import { LanguageLine } from "./LanguageLine";
import { Logo } from "./Logo";
import { AudioOutbox } from "@/lib/outbox";

/** Languages people most often need face to face; the rest are under "More". */
const COMMON = ["tr", "es", "zh", "ar", "hi", "fr", "pt", "ru", "ja", "ko", "de", "it", "id", "vi", "th", "en"];
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

  // The languages of people you talk to (Recent) come first, then the most common ones.
  const [known, setKnown] = useState<string[]>([]);
  useEffect(() => {
    setMine(loadLang().speaks);
    setKnown(loadRecent().flatMap((r) => (baseLang(r.lang) ? [baseLang(r.lang)!] : [])));
  }, []);
  const myBase = baseLang(mine);
  const choices = [...new Set([...known, ...COMMON])].filter((c) => c !== myBase);

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
            // Whatever "change" below last set, not what it was when this screen opened.
            const myNow = loadLang().speaks;
            setMine(myNow);
            const s = new Session(myNow, detect ? null : theirs, () => setPhase("live"));
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
        <KeepSign />
        <LanguageLine />
      </main>
    );

  return <Live session={session.current} onEnd={() => router.push("/")} />;
}

/** The running conversation: the connection, the microphone and what's on each half. */
class Session {
  ws: WebSocket | null = null;
  /** Mic audio waiting for a slow or dropped connection (lib/outbox.ts), and the socket that is ready. */
  private outbox = new AudioOutbox();
  private readyWs: WebSocket | null = null;
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
  /** Everything said, in order, in both languages: so it can be saved when the conversation ends. */
  log = new Map<string, { by: "me" | "them"; said: string; read: string; at: number }>();
  startedAt = Date.now();
  endedAt = 0;
  /** Counts changes to the log, so saving only happens when there is something new. */
  rev = 0;
  private note(id: string, by: "me" | "them", part: { said?: string; read?: string }) {
    const key = id.replace(/~s$/, "");
    const e = this.log.get(key) ?? { by, said: "", read: "", at: Date.now() };
    if (part.said) e.said = part.said;
    if (part.read) e.read = part.read;
    this.log.set(key, e);
    this.rev++;
  }
  /** The conversation so far, ready to keep. */
  talk(): SavedTalk {
    return {
      id: `ip-${this.startedAt}`,
      kind: "inperson",
      startedAt: this.startedAt,
      endedAt: this.endedAt || Date.now(),
      with: [],
      langs: [this.mine, this.theirs ?? ""].filter(Boolean),
      lines: [...this.log.values()].filter((l) => l.said.trim() || l.read.trim()).map((l) => ({ who: l.by, said: l.said.trim() || undefined, read: l.read.trim() || undefined, at: l.at })),
    };
  }

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
        if (!on) this.outbox.mark(this.ws, JSON.stringify({ t: "speech", on: false }), !!this.ws && this.ws === this.readyWs);
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
        this.readyWs = ws;
        this.outbox.flush(ws);
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
        // A caption on my half is their words translated, and the other way round.
        const shown = `${m.text}${m.tail ? ` ${m.tail}` : ""}`.trim();
        if (shown) this.note(m.id, m.for === "me" ? "them" : "me", { read: shown });
      } else if (m.t === "own") {
        const line = { id: m.id, text: m.text, final: m.final, at: Date.now() };
        if (m.by === "me") this.ownMe = line;
        else this.ownThem = line;
        if (m.text.trim()) this.note(m.id, m.by, { said: m.text });
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
    const frame = new Uint8Array(pcm.byteLength + 1);
    frame[0] = Math.max(0, Math.min(255, Math.round(db + 120)));
    frame.set(new Uint8Array(pcm), 1);
    // A slow or dropped connection holds the audio on the phone instead of losing it.
    this.outbox.audio(this.ws, frame, db, !!this.ws && this.ws === this.readyWs);
  }

  setTheirs(lang: string) {
    this.theirs = lang;
    this.send({ t: "theirs", lang });
    this.changed();
  }

  setMine(lang: string) {
    this.mine = lang;
    this.send({ t: "mine", lang });
    this.changed();
  }

  end() {
    if (this.ended) return;
    this.ended = true;
    this.endedAt = Date.now();
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
  /** Whose language list is open (each opens inside that person's half, the right way up). */
  const [picking, setPicking] = useState<"me" | "them" | null>(null);
  const [them, setThem] = useState<Strings>(en);
  useEffect(() => {
    const f = () => setTick((n) => n + 1);
    s.listeners.add(f);
    return () => {
      s.listeners.delete(f);
    };
  }, [s]);
  useEffect(() => () => s.end(), [s]);
  // Every line is written to this phone the moment it changes (a recovery copy, or a kept
  // conversation for people who turned that on), and again when the app is put away. So a dead
  // battery, a crash, a locked phone or a swipe away loses nothing.
  const ended = useRef(false);
  const [storeFailed, setStoreFailed] = useState(false);
  useEffect(() => {
    let saved = -1;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const save = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (s.rev === saved) return;
      saved = s.rev;
      void stashTalk(s.talk(), !ended.current).then((ok) => setStoreFailed(!ok));
    };
    const soon = () => {
      if (!timer) timer = setTimeout(save, 600);
    };
    s.listeners.add(soon);
    const hidden = () => document.visibilityState !== "visible" && save();
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", save);
    window.addEventListener("freeze", save);
    return () => {
      s.listeners.delete(soon);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", save);
      window.removeEventListener("freeze", save);
      // Leaving without the End button (back gesture, a notification, a link): still saved, and
      // offered again on the home screen.
      saved = -1;
      save();
    };
  }, [s]);
  /** Ended with something said: a last chance to save it before leaving. */
  const [done, setDone] = useState(false);
  const [keep, setKeep] = useState(false);
  useEffect(() => setKeep(keepsTalks()), []);
  const finish = () => {
    s.end();
    if (s.talk().lines.length === 0) return onEnd();
    ended.current = true;
    void stashTalk(s.talk(), false).then((ok) => setStoreFailed(!ok));
    setDone(true);
  };

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

  return (
    <main className={`ip-live ${flipped ? "flipped" : ""}`} style={{ ["--cap-size" as string]: SIZES[size] }}>
      {done && (
        <div className="ip-end" role="dialog" aria-modal="true" aria-label={t("talkEnded")}>
          <div className="ip-end-card">
            <h2>{t("talkEnded")}</h2>
            <p className="muted small">
              {t("talkLines", { n: String(s.talk().lines.length) })} · {t("minutesShort", { n: String(Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000))) })}
            </p>
            <button className="btn primary" onClick={() => void saveTranscript(talkText(s.talk(), { you: t("you"), them: t("talkThem"), title: t("talkInPerson") }), `simpatico-${new Date(s.startedAt).toISOString().slice(0, 16).replace(/[:T]/g, "-")}.txt`)}>
              {t("talkSave")}
            </button>
            <label className="check">
              <input
                type="checkbox"
                checked={keep}
                onChange={(e) => {
                  setKeep(e.target.checked);
                  setKeepTalks(e.target.checked);
                  void stashTalk(s.talk(), false).then((ok) => setStoreFailed(!ok));
                }}
              />
              <span>
                {keep ? t("talkKept") : t("keepTalks")}
                <small className="muted">{t("keepTalksHint")}</small>
              </span>
            </label>
            {storeFailed && <p className="small clear-warn">{t("talkStoreFailed")}</p>}
            {!keep && !storeFailed && <p className="muted small">{t("talkRecoveryNote", { n: String(RECOVERY_DAYS) })}</p>}
            <button className="btn" onClick={onEnd}>
              {t("talkDone")}
            </button>
          </div>
        </div>
      )}
      <section className="ip-half them" lang={s.theirs ?? undefined} dir={s.theirs && isRtl(s.theirs) ? "rtl" : "ltr"}>
        <div className="ip-head">
          {/* New key when their language is known: the label pops in, so it's noticed. */}
          <button key={s.theirs ?? "detecting"} className={`ip-lang ${s.theirs ? "ip-lang-set" : "ip-lang-detecting"}`} onClick={() => setPicking("them")}>
            {s.theirs ? langInfo(s.theirs).native : tt("ipDetecting")} ▾
          </button>
          {iTalk ? <span className="ip-talking">{tt("ipTalking")}</span> : null}
        </div>
        <div className="ip-caps">
          {s.forThem.length ? (
            <CaptionBox captions={s.forThem} names={null} lang={s.theirs ?? undefined} speaking={iTalk} tr={tt} />
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
        {picking === "them" && (
          <LangList
            title={tt("ipYourLang")}
            current={s.theirs}
            exclude={s.mine}
            onPick={(code) => {
              s.setTheirs(code);
              setPicking(null);
            }}
            onClose={() => setPicking(null)}
          />
        )}
      </section>

      {/* The owner's controls, in the owner's language. */}
      <nav className="ip-mid">
        <button className="pill" onClick={() => setFlipped((f) => !f)} aria-label={t("ipFlip")}>
          ⇅ {t("ipFlip")}
        </button>
        <button className="pill" onClick={() => setSize((n) => (n + 1) % SIZES.length)} aria-label={t("ipSize")}>
          Aa
        </button>
        <button
          className="pill end"
          onClick={finish}
        >
          {t("ipEnd")}
        </button>
      </nav>

      <section className="ip-half me">
        <div className="ip-head">
          <button className="ip-lang" onClick={() => setPicking("me")}>
            {langInfo(s.mine).native} ▾
          </button>
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
        {picking === "me" && (
          <LangList
            title={t("ipYourLang")}
            current={s.mine}
            exclude={s.theirs}
            onPick={(code) => {
              s.setMine(code);
              setPicking(null);
            }}
            onClose={() => setPicking(null)}
          />
        )}
      </section>
    </main>
  );
}

/**
 * A language list that opens inside one person's half (so it's the right way up for them).
 * Our own list rather than the phone's picker, which misbehaves inside an upside-down screen.
 */
function LangList({ title, current, exclude, onPick, onClose }: { title: string; current: string | null; exclude: string | null; onPick: (code: string) => void; onClose: () => void }) {
  const cur = baseLang(current);
  const not = baseLang(exclude);
  const first = [...new Set([...loadRecent().flatMap((r) => (baseLang(r.lang) ? [baseLang(r.lang)!] : [])), ...COMMON])].filter((c) => c !== not);
  const rest = SORTED.filter((l) => l.code !== not && !first.includes(l.code));
  const item = (code: string, native: string, name: string) => (
    <button key={code} className={`ip-lang-item ${code === cur ? "on" : ""}`} onClick={() => onPick(code)}>
      <b>{native}</b>
      {native !== name && <small>{name}</small>}
    </button>
  );
  return (
    <div className="ip-langs" role="dialog" aria-label={title}>
      <div className="ip-langs-head">
        <b>{title}</b>
        <button className="round-btn" onClick={onClose} aria-label="×">
          ×
        </button>
      </div>
      <div className="ip-langs-list">
        {first.map((c) => item(c, langInfo(c).native, langInfo(c).name))}
        <hr />
        {rest.map((l) => item(l.code, l.native, l.name))}
      </div>
    </div>
  );
}
