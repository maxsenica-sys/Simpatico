// Service worker: makes the app installable and shows "someone's waiting" notifications for
// call cards. Calls are live by nature, so nothing is cached: every request goes to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {}
  const url = typeof d.url === "string" && d.url.startsWith("/r/") ? d.url : "/";
  e.waitUntil(
    self.registration.showNotification(d.title || "Simpatico", {
      body: d.body || "",
      tag: d.tag || "simpatico",
      renotify: true,
      icon: "/icons/192",
      badge: "/icons/192",
      data: { url },
    }),
  );
});

// Tap the notification: go to that call card. A window already there is focused; any other
// window (it may be in another call) is left alone and the card opens fresh.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) if (w.url.split("?")[0] === url && "focus" in w) return w.focus();
      return self.clients.openWindow(url);
    }),
  );
});
