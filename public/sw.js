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

// Tap the notification: open the call card (reuse an open Simpatico window if there is one).
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          w.navigate?.(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
