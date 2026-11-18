"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Caption } from "@/lib/call";
import { useT } from "@/lib/i18n";

/** Captions disappear this long after the last words, when nobody is reading back. */
const LAST_LINGER_MS = 20_000;
const FADE_MS = 600;
/** Sentences this close together (same person) are one run of speech, kept whole. */
const RUN_GAP_MS = 3000;
/** Before the current run: only the last few short lines (about two lines' worth). */
const EARLIER_MAX = 3;
/** Lines kept for reading back (a long monologue is many lines). */
const HISTORY = 40;

type Line = Caption & { startAt: number };

/**
 * The other person's words in a box that stays still: the text never changes size, the box
 * never changes height, and new words appear at the bottom, pushing older lines up. Left-aligned
 * in a column set slightly in from the left, so lines don't shift sideways as words arrive.
 *
 * Long speech is kept whole, so you can scroll back through it with your finger (a scroll bar
 * and "Scroll for earlier" show there's more; "Latest" jumps back). Short back-and-forth keeps
 * only the last couple of lines before the current sentence: enough to follow, no clutter.
 * While you're reading back, nothing is removed or moved under you.
 */
export function CaptionBox({
  captions,
  names,
  lang,
  speaking,
}: {
  captions: Caption[];
  /** Group calls: speaker names by id, shown before each line. */
  names: Record<string, string> | null;
  lang?: string;
  speaking: boolean;
}) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const history = useRef<Line[]>([]);
  const held = useRef<string[] | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [bar, setBar] = useState<{ top: number; height: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Remember every line (the call keeps settled ones for only 30 s) with when it started.
  const h = history.current;
  for (const c of captions) {
    const i = h.findIndex((x) => x.id === c.id);
    if (i < 0) h.push({ ...c, startAt: c.updatedAt });
    else if (h[i].doneAt === null) h[i] = { ...c, startAt: h[i].startAt };
  }
  if (h.length > HISTORY) h.splice(0, h.length - HISTORY);

  // Which lines to show: the current run whole, plus a little of what came before.
  let shown: Line[] = [];
  if (h.length) {
    let i = h.length - 1;
    while (i > 0) {
      const prev = h[i - 1];
      const cur = h[i];
      const sameRun = prev.from === cur.from && (prev.doneAt === null || cur.startAt - prev.doneAt < RUN_GAP_MS);
      if (!sameRun) break;
      i--;
    }
    // A line still being translated always stays (someone else may have started talking
    // after it, but its words are still arriving), with everything after it.
    const firstActive = h.findIndex((x) => x.doneAt === null);
    if (firstActive >= 0 && firstActive < i) i = firstActive;
    const run = h.slice(i);
    const earlier: Line[] = [];
    let chars = 0;
    const lineChars = Math.max(24, Math.round((box.current?.clientWidth ?? 360) / 17));
    for (let j = i - 1; j >= 0 && earlier.length < EARLIER_MAX; j--) {
      // Only recent lines: after a quiet spell the box starts afresh.
      const done = h[j].doneAt;
      if (done !== null && now - done > LAST_LINGER_MS) break;
      chars += h[j].text.length;
      if (earlier.length && chars > lineChars * 2) break;
      earlier.unshift(h[j]);
    }
    shown = [...earlier, ...run];
  }
  // Reading back: keep everything from the first line that was on screen down to the newest,
  // with nothing taken out of the middle (a line dropping out moved the text you were reading).
  if (!atBottom && held.current?.length) {
    const firstHeld = h.findIndex((x) => x.id === held.current![0]);
    const firstShown = shown[0] ? h.indexOf(shown[0]) : h.length;
    const from = firstHeld >= 0 ? Math.min(firstHeld, firstShown) : firstShown;
    shown = h.slice(from);
  }
  held.current = shown.map((x) => x.id);

  // Quiet = nobody's words still arriving, and the last ones finished a while ago. (It used to
  // look only at the newest line: in a group, someone's short "ok" going stale hid the person
  // still talking.)
  const anyActive = shown.some((x) => x.doneAt === null);
  const lastDone = Math.max(0, ...shown.map((x) => x.doneAt ?? 0));
  const quiet = shown.length > 0 && !anyActive && now - lastDone > LAST_LINGER_MS;
  const fading = quiet && atBottom;
  const gone = fading && now - lastDone > LAST_LINGER_MS + FADE_MS;

  // Only a finger or a wheel moves you away from the newest words; the box's own gliding doesn't.
  // While a finger is on the box (and just after), the box never moves the text itself: it
  // used to keep gliding to the newest words during a long sentence and pull you back down.
  const touchedAt = useRef(0);
  const holding = useRef(false);
  const glide = useRef<number | null>(null);
  const touched = () => {
    touchedAt.current = Date.now();
    if (glide.current !== null) cancelAnimationFrame(glide.current);
    glide.current = null;
  };
  const hands = () => holding.current || Date.now() - touchedAt.current < 700;
  /** Where the newest sentence sat on screen last time, so an update never moves it down. */
  const anchor = useRef<{ id: string; top: number } | null>(null);
  const saveAnchor = (el: HTMLDivElement) => {
    const a = Array.from(el.querySelectorAll<HTMLElement>("p.cap")).at(-1);
    anchor.current = a ? { id: a.dataset.id ?? "", top: a.getBoundingClientRect().top } : null;
  };
  /** The last scroll position seen, to tell a finger moving the text up from new words arriving. */
  const lastScroll = useRef(0);
  const measure = (fromScroll = false) => {
    const el = box.current;
    if (!el) return;
    saveAnchor(el);
    const over = el.scrollHeight - el.clientHeight;
    const bottom = over - el.scrollTop < 8;
    if (bottom) setAtBottom(true);
    // Only a scroll the person made, towards earlier lines, stops following the newest words.
    // (New words arriving also leave the view short of the bottom for a moment; just after a
    // touch that used to be taken for scrolling back, and the box stopped following.)
    else if (fromScroll && Date.now() - touchedAt.current < 1500 && el.scrollTop < lastScroll.current - 2) setAtBottom(false);
    lastScroll.current = el.scrollTop;
    if (over <= 2) return setBar(null);
    const height = Math.max(16, (el.clientHeight / el.scrollHeight) * el.clientHeight);
    setBar({ height, top: (el.scrollTop / over) * (el.clientHeight - height) });
  };

  /**
   * Keep the text still while sentences are being translated:
   * - No line ever takes less room than it once did. The faint preview at the end of a line
   *   grows and shrinks as the translation catches up; without this, the line count flickers
   *   and the text around it jumps. In a group several people's lines can be changing at once,
   *   so every line keeps its own space (an invisible spacer under it), not just the newest.
   * - New lines glide in (about a quarter of a second) instead of the text snapping up.
   */
  const reserve = useRef(new Map<string, number>());
  const following = useRef(true);
  following.current = atBottom;
  // Glide towards the newest words, chasing the bottom as it moves: translations stream in
  // several times a second, so the target keeps changing and the glide must always catch up
  // (a fixed-length animation restarted on each update never reached the last line).
  const glideTo = (el: HTMLDivElement) => {
    if (glide.current !== null) return; // already on its way; it reads the latest target each frame
    const step = () => {
      const to = el.scrollHeight - el.clientHeight;
      const d = to - el.scrollTop;
      if (!following.current || hands() || d <= 0.5) {
        glide.current = null;
        return;
      }
      el.scrollTop += d < 2 ? d : Math.max(1, d * 0.2);
      saveAnchor(el);
      glide.current = requestAnimationFrame(step);
    };
    glide.current = requestAnimationFrame(step);
  };
  useEffect(() => () => void (glide.current !== null && cancelAnimationFrame(glide.current)), []);

  const sig = shown.map((x) => `${x.id}:${x.text.length}:${x.tail?.length ?? 0}`).join("|");
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const kept = new Map<string, number>();
    for (const p of Array.from(el.querySelectorAll<HTMLElement>("p.cap"))) {
      const id = p.dataset.id ?? "";
      const gap = p.nextElementSibling as HTMLElement | null;
      if (!gap?.classList.contains("cap-reserve")) continue;
      const h = p.offsetHeight;
      const r = Math.max(reserve.current.get(id) ?? 0, h);
      gap.style.height = `${r - h}px`;
      kept.set(id, r);
    }
    reserve.current = kept;
    // Following the newest words: whatever changed (a line above finishing with slightly longer
    // wording, the box filling up), the sentence being read must not slip down. Scroll it back
    // to where it was before anything is drawn; the glide below then moves it up smoothly.
    if (atBottom && !hands() && anchor.current) {
      const a = Array.from(el.querySelectorAll<HTMLElement>("p.cap")).find((x) => x.dataset.id === anchor.current!.id);
      const slipped = a ? a.getBoundingClientRect().top - anchor.current.top : 0;
      if (slipped > 0.5) el.scrollTop += slipped;
    }
    // New words: follow them, unless you've scrolled back to read.
    if (atBottom && !hands()) glideTo(el);
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const scrolledUp = !!bar && !!box.current && box.current.scrollTop > 2;
  const waiting = speaking && !shown.some((c) => c.doneAt === null && (c.stage === "live" || c.tail));
  return (
    <div className="captions-zone boxed">
      {/* Under the box, where "Latest" appears once you scroll back. */}
      {bar && !gone && atBottom && <span className="cap-scroll-hint">{t("ownScroll")}</span>}
      <div className={`cap-frame ${bar ? "scrollable" : ""}`}>
        <div
          className={`captions cap-box-scroll ${scrolledUp ? "faded" : ""} ${fading ? "fading" : ""}`}
          ref={box}
          onScroll={() => measure(true)}
          onTouchStart={() => {
            holding.current = true;
            touched();
          }}
          onTouchMove={touched}
          onTouchEnd={() => {
            holding.current = false;
            touched();
          }}
          onTouchCancel={() => {
            holding.current = false;
            touched();
          }}
          onWheel={touched}
          onPointerDown={touched}
          aria-live="polite"
          lang={lang}
        >
          <div className="cap-fill" />
          {!gone &&
            shown.map((c, i) => [
              <p key={c.id} data-id={c.id} className={`cap ${c.doneAt === null ? (c.stage === "steady" ? "steady" : "live") : "done"}`} dir="auto">
                {/* Who is talking: once, where the speaker changes, not on every line. */}
                {names && shown[i - 1]?.from !== c.from && <span className="cap-who">{names[c.from] ?? ""}</span>}
                {c.text}
                {c.tail && (
                  <span className="cap-tail" aria-hidden="true">
                    {c.text ? " " : ""}
                    {c.tail}
                  </span>
                )}
              </p>,
              <div key={`${c.id}-gap`} className="cap-reserve" aria-hidden="true" />,
            ])}
        </div>
        {bar && !gone && (
          <div className="cap-track-bar" aria-hidden="true">
            <div className="cap-thumb" style={{ top: bar.top, height: bar.height }} />
          </div>
        )}
      </div>
      {!atBottom && (
        <button
          className="cap-latest"
          onClick={() => {
            const el = box.current;
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
          }}
        >
          ↓ {t("ownLatest")}
        </button>
      )}
      {/* They're talking but no words have arrived yet: show that something is coming. */}
      {waiting && (
        <div className="typing" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}
