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
};

function plugins(): Plugins | null {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: Plugins } }).Capacitor;
  return cap?.isNativePlatform?.() ? (cap.Plugins ?? null) : null;
}

/** Share a link with the phone's own share sheet (app shell or browser). */
export function canShareLink(): boolean {
  return !!plugins()?.Share || (typeof navigator !== "undefined" && !!navigator.share);
}

export async function shareLink(url: string): Promise<void> {
  const native = plugins()?.Share;
  if (native) return void (await native.share({ url }).catch(() => {}));
  await navigator.share?.({ url }).catch(() => {});
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
