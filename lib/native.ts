"use client";

/**
 * Bridges to the Simpatico app shells (Capacitor, see mobile/). The shell injects
 * `window.Capacitor` into this same web app; in a browser none of this exists and callers
 * fall back to web APIs.
 */
type Plugins = {
  App?: { addListener(event: "appUrlOpen", cb: (e: { url: string }) => void): Promise<unknown> };
  Share?: { share(o: { url?: string; title?: string; text?: string }): Promise<unknown> };
  VoiceFocus?: { showMicModes(): Promise<{ shown: boolean }>; status(): Promise<{ mode: string; available: boolean }> };
  Filesystem?: {
    writeFile(o: { path: string; data: string; directory: string; encoding: string; recursive?: boolean }): Promise<unknown>;
    deleteFile(o: { path: string; directory: string }): Promise<unknown>;
  };
};

function plugins(): Plugins | null {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Plugins } }).Capacitor;
  return cap?.isNativePlatform?.() ? (cap.Plugins ?? null) : null;
}

/** Share a link with the phone's own share sheet (app shell or browser). */
export function canShareLink(): boolean {
  return !!plugins()?.Share || (typeof navigator !== "undefined" && !!navigator.share);
}

/** Share a link, with an optional friendly message in front of it. */
export async function shareLink(url: string, text?: string): Promise<void> {
  const native = plugins()?.Share;
  if (native) return void (await native.share({ url, text }).catch(() => {}));
  await navigator.share?.(text ? { text, url } : { url }).catch(() => {});
}

/** iPhone app only: opens iOS's microphone mode picker (Voice Isolation keeps just your voice). */
export function hasMicModes(): boolean {
  return !!plugins()?.VoiceFocus;
}

export async function showMicModes(): Promise<boolean> {
  const vf = plugins()?.VoiceFocus;
  if (!vf) return false;
  return (await vf.showMicModes().catch(() => ({ shown: false }))).shown;
}

let linksInstalled = false;

/** App shells: a Simpatico call link tapped while the app is open loads that call. */
export function installNativeLinks() {
  const app = plugins()?.App;
  if (!app || linksInstalled) return;
  linksInstalled = true;
  void app.addListener("appUrlOpen", ({ url }) => {
    try {
      const u = new URL(url);
      if (u.pathname.startsWith("/r/")) location.assign(u.pathname + u.search);
    } catch {}
  });
}

/**
 * iPhone app only: a kept conversation is also written as a plain text file in the app's own
 * Documents folder ("On My iPhone > Simpatico > Conversations" in the Files app), which the
 * phone's own backups include. So it survives the web storage being cleared. Both languages.
 */
type TalkFile = { kind: string; startedAt: number; with: string[]; lines: { who: "me" | "them"; name?: string; said?: string; read?: string; at: number }[] };
function talkFilePath(t: TalkFile): string {
  const d = new Date(t.startedAt);
  const two = (n: number) => String(n).padStart(2, "0");
  const who = (t.with.join(" ") || (t.kind === "inperson" ? "In person" : "Call")).replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 40).trim() || "Conversation";
  return `Conversations/${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}.${two(d.getMinutes())} ${who}.txt`;
}
export async function writeTalkFile(t: TalkFile): Promise<void> {
  const fs = plugins()?.Filesystem;
  if (!fs) return;
  const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const body = t.lines
    .map((l) => {
      const first = (l.said ?? "").trim() || (l.read ?? "").trim();
      const second = (l.said ?? "").trim() && (l.read ?? "").trim() ? `\n    -> ${l.read!.trim()}` : "";
      return `[${time(l.at)}] ${l.who === "me" ? "Me" : l.name || "Them"}: ${first}${second}`;
    })
    .join("\n");
  const head = `Simpatico · ${new Date(t.startedAt).toLocaleString()}${t.with.length ? ` · ${t.with.join(", ")}` : ""}`;
  await fs.writeFile({ path: talkFilePath(t), data: `${head}\n\n${body}\n`, directory: "DOCUMENTS", encoding: "utf8", recursive: true }).catch(() => {});
}
export async function removeTalkFile(t: TalkFile): Promise<void> {
  await plugins()?.Filesystem?.deleteFile({ path: talkFilePath(t), directory: "DOCUMENTS" }).catch(() => {});
}
