const CACHE = "steppe-v12";
self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// Stale-while-revalidate: instant (offline-capable) start, new deploys land on the next launch.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Only our own files: ads/analytics and other third-party requests always go straight to the network.
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(e.request).then((hit) => {
        const net = fetch(e.request).then((res) => {
          if (res && res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch((err) => {
          console.warn("SW fetch failed", e.request.url, err);
          return hit || (e.request.mode === "navigate" ? cache.match("./index.html") : undefined);
        });
        if (hit) { e.waitUntil(net); return hit; }
        return net;
      })
    )
  );
});
