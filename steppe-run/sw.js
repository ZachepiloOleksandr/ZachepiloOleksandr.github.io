const CACHE = "steppe-v16";
const NET_TIMEOUT_MS = 4000;
self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fetchFresh(req) {
  // no-cache: revalidate with the server (cheap 304s) so a deploy is picked up on the very next load.
  const net = fetch(new Request(req, { cache: "no-cache" }));
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NET_TIMEOUT_MS));
  return Promise.race([net, timeout]);
}

// Network-first: always the current deploy (no mix of old JS with new HTML); the cache only serves offline.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Only our own files: ads/analytics and other third-party requests always go straight to the network.
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetchFresh(e.request);
      if (res && res.ok) cache.put(e.request, res.clone());
      return res;
    } catch (err) {
      console.warn("SW network failed, serving cache", e.request.url, err);
      const hit = (await cache.match(e.request)) || (e.request.mode === "navigate" ? await cache.match("./index.html") : undefined);
      return hit || Response.error();
    }
  })());
});
