"use client";
import type { TranscriptLine } from "./call";

/** The transcript as plain text: one line per sentence, with time and who said it. */
export function transcriptText(lines: TranscriptLine[], names: Record<string, string>, you: string, title: string, media: { image: string; video: string } = { image: "[photo]", video: "[video]" }): string {
  const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const head = `${title} · ${new Date(lines[0]?.at ?? Date.now()).toLocaleString()}`;
  const body = lines
    .filter((l) => l.final && (l.text || l.media))
    .map((l) => `[${time(l.at)}] ${l.who === "me" ? you : (l.from && names[l.from]) || "—"}: ${l.text || (l.media?.kind === "video" ? media.video : media.image)}${l.other && l.text ? `\n    → ${l.other}` : ""}`)
    .join("\n");
  return `${head}\n\n${body}\n`;
}

/** Share sheet on phones (save to Files, send to WhatsApp…), a download elsewhere. */
export async function saveTranscript(text: string, filename: string) {
  const file = new File([text], filename, { type: "text/plain" });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return;
    }
  } catch (err) {
    if ((err as DOMException)?.name === "AbortError") return; // they closed the share sheet
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
