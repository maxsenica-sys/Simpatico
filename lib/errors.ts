"use client";

let installed = false;
let sent = 0;

/** Development phase: send uncaught errors from testers' browsers to the dashboard (max 5 per page). */
export function installErrorReporter() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const report = (message: string, stack?: string) => {
    if (sent++ >= 5) return;
    const body = JSON.stringify({ message: message.slice(0, 500), stack: stack?.slice(0, 2000), path: location.pathname });
    try {
      if (!navigator.sendBeacon?.("/api/client-error", new Blob([body], { type: "application/json" })))
        fetch("/api/client-error", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    } catch {}
  };
  window.addEventListener("error", (e) => report(e.message || "error", e.error?.stack));
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason as { message?: string; stack?: string } | string | undefined;
    report(typeof r === "string" ? r : r?.message || "unhandled rejection", typeof r === "object" ? r?.stack : undefined);
  });
}
