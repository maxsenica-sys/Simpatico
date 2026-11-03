// Minimal service worker so the app is installable. Calls are live by nature, so
// nothing is cached: every request goes to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
