"use client";

export type BrowserEnv = {
  ios: boolean;
  android: boolean;
  /** Name of the app whose embedded browser we're in, if any. */
  inApp: string | null;
  canCall: boolean;
  standalone: boolean;
  /** Inside the Simpatico iPhone / Android app (Capacitor shell), not a browser. */
  nativeApp: boolean;
};

/** The app shells append this to the web view's user agent (mobile/capacitor.config.ts). */
export const NATIVE_APP_UA = /SimpaticoApp\//;

export function isNativeApp(): boolean {
  return typeof navigator !== "undefined" && NATIVE_APP_UA.test(navigator.userAgent);
}

const IN_APP: [RegExp, string][] = [
  [/Instagram/i, "Instagram"],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, "Facebook"],
  [/WhatsApp/i, "WhatsApp"],
  [/\bLine\//i, "LINE"],
  [/Snapchat/i, "Snapchat"],
  [/musical_ly|TikTok|BytedanceWebview/i, "TikTok"],
  [/Twitter/i, "X"],
  [/LinkedInApp/i, "LinkedIn"],
  [/MicroMessenger/i, "WeChat"],
  [/\bGSA\//i, "Google"],
  [/Telegram/i, "Telegram"],
];

export function detectEnv(): BrowserEnv {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const hasMedia = !!navigator.mediaDevices?.getUserMedia && typeof RTCPeerConnection !== "undefined";
  const nativeApp = NATIVE_APP_UA.test(ua);
  let inApp = nativeApp ? null : (IN_APP.find(([re]) => re.test(ua))?.[1] ?? null);
  // Android WebViews and iOS WKWebViews without getUserMedia are embedded browsers too
  // (our own app's web view is not: it can call).
  if (!inApp && !nativeApp && android && /; wv\)/.test(ua)) inApp = "app";
  if (!inApp && !nativeApp && ios && !hasMedia) inApp = "app";
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return { ios, android, inApp, canCall: hasMedia, standalone, nativeApp };
}

/** Best-effort deep link that opens the current page in the system browser. */
export function systemBrowserUrl(env: BrowserEnv, url: string): string | null {
  if (env.ios) return url.replace(/^https?:\/\//, (m) => `x-safari-${m}`);
  if (env.android) {
    const u = new URL(url);
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(":", "")};package=com.android.chrome;end`;
  }
  return null;
}
