"use client";

/**
 * Keeps the screen on during a call (people read captions without touching the phone).
 * Screen Wake Lock API: Safari 16.4+, Chrome, and the app shells' web views. The lock is
 * dropped by the browser whenever the page is hidden, so it is taken again on return.
 */
export class ScreenAwake {
  private lock: { release(): Promise<void> } | null = null;
  private wanted = false;
  private readonly onVisible = () => {
    if (this.wanted && document.visibilityState === "visible") void this.take();
  };

  on() {
    if (this.wanted) return;
    this.wanted = true;
    document.addEventListener("visibilitychange", this.onVisible);
    void this.take();
  }

  off() {
    this.wanted = false;
    document.removeEventListener("visibilitychange", this.onVisible);
    this.lock?.release().catch(() => {});
    this.lock = null;
  }

  private async take() {
    const wl = (navigator as { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock;
    if (!wl || this.lock) return;
    try {
      const lock = await wl.request("screen");
      if (!this.wanted) return void lock.release().catch(() => {});
      this.lock = lock;
      (lock as unknown as EventTarget).addEventListener?.("release", () => {
        if (this.lock === lock) this.lock = null;
      });
    } catch {
      // Not allowed right now (battery saver, hidden page): fine, the call works without it.
    }
  }
}
