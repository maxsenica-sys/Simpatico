// Test bench for the caption box (components/CaptionBox.tsx): the real component, fed scripted
// calls, so scrolling and line-handling bugs can be reproduced and checked automatically.
// Built and driven by test/captionbox/run.mjs.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { CaptionBox } from "@/components/CaptionBox";
import type { Caption } from "@/lib/call";

type Msg = { from: string; id: string; stage: "steady" | "final"; text: string; tail?: string };
let push: (m: Msg) => void = () => {};

/** Same rules as the call (lib/call.ts onCaption): settled lines never change, kept 30 s. */
function apply(captions: Caption[], m: Msg): Caption[] {
  const now = Date.now();
  const list = captions.filter((c) => c.doneAt === null || now - c.doneAt < 30_000);
  const i = list.findIndex((c) => c.id === m.id);
  const done = m.stage === "final";
  if (i >= 0) {
    if (list[i].doneAt !== null) return list;
    list[i] = { ...list[i], text: m.text, tail: m.tail, stage: m.stage, updatedAt: now, doneAt: done ? now : null };
  } else if (m.text || m.tail) list.push({ id: m.id, from: m.from, text: m.text, tail: m.tail, stage: m.stage, updatedAt: now, doneAt: done ? now : null });
  return list.filter((c) => c.text || c.tail);
}

function App() {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [names, setNames] = useState<Record<string, string> | null>({ a: "Ezgi" });
  // In person shows one half upside down: the box must behave the same either way up.
  const [rotated, setRotated] = useState(false);
  useEffect(() => {
    push = (m) => setCaptions((c) => apply(c, m));
    (window as unknown as { setNames: typeof setNames; setRotated: typeof setRotated }).setNames = setNames;
    (window as unknown as { setRotated: typeof setRotated }).setRotated = setRotated;
  }, []);
  return (
    <div className="call" style={{ position: "fixed", inset: 0, transform: rotated ? "rotate(180deg)" : undefined, ["--cap-size" as string]: "clamp(24px, 3.6vw, 38px)" }}>
      <CaptionBox captions={captions} names={names} lang="en" speaking={captions.some((c) => c.doneAt === null)} />
    </div>
  );
}

(window as unknown as { push: (m: Msg) => void }).push = (m: Msg) => push(m);
createRoot(document.getElementById("root")!).render(<App />);
