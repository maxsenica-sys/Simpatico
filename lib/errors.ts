"use client";

let installed = false;
let sent = 0;

/** Development phase: send uncaught errors from testers' browsers to the dashboard (max 5 per page). */
export function reportError(message: string, stack?: string) {
  report(message, stack);
}

/**
 * What was last tapped, so a report says "after tapping Flip" rather than just "froze". Only the
 * button's own label or class (app wording), never anything said or typed.
 */
let lastTap = "";
let lastTapAt = 0;

function report(message: string, stack?: string) {
    if (sent++ >= 5) return;
    const tapped = lastTap ? `${lastTap} (${Math.round((Date.now() - lastTapAt) / 1000)} s before)` : undefined;
    const body = JSON.stringify({ message: message.slice(0, 500), stack: stack?.slice(0, 2000), path: location.pathname, tapped });
    try {
      if (!navigator.sendBeacon?.("/api/client-error", new Blob([body], { type: "application/json" })))
        fetch("/api/client-error", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    } catch {}
}

export function installErrorReporter() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => report(e.message || "error", e.error?.stack));
  document.addEventListener(
    "pointerdown",
    (e) => {
      const el = (e.target as Element | null)?.closest?.("button, a, [role=button], select, input");
      if (!el) return;
      const label = el.getAttribute("aria-label") || el.getAttribute("title") || [...el.classList].slice(0, 2).join(".") || el.tagName.toLowerCase();
      lastTap = label.slice(0, 60);
      lastTapAt = Date.now();
    },
    { capture: true, passive: true },
  );
  // Freezes throw no error: notice when the page stopped responding for 3 s or more while it
  // was on screen (a hidden or locked page is paused on purpose), and say what was last tapped.
  let tick = Date.now();
  let shown = document.visibilityState === "visible";
  setInterval(() => {
    const now = Date.now();
    const visible = document.visibilityState === "visible";
    if (visible && shown && now - tick > 3000) report(`freeze: page stopped responding for ${Math.round((now - tick) / 1000)} s`);
    tick = now;
    shown = visible;
  }, 1000);
  document.addEventListener("visibilitychange", () => {
    shown = false;
    tick = Date.now();
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason as { message?: string; stack?: string } | string | undefined;
    report(typeof r === "string" ? r : r?.message || "unhandled rejection", typeof r === "object" ? r?.stack : undefined);
  });
}
