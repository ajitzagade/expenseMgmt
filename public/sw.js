/*
 * TripSplit service worker.
 *
 * Caching policy (deliberately conservative for a financial app):
 *  - Static assets (/_next/static, icons, fonts): cache-first — they are
 *    content-hashed and immutable.
 *  - Page navigations: network-first with a small offline fallback page.
 *    Rendered pages are NOT kept in cache, so no stale balances are shown.
 *  - /api/* and all non-GET requests: never touched by the cache. Financial
 *    reads and writes always go to the server.
 */
const VERSION = "tripsplit-v3";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png", "/icons/icon.svg"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Financial data is never served from a cache.
  if (url.pathname.startsWith("/api/")) return;

  const isStaticAsset = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then(async (cache) => {
                await cache.put(request, copy);
                trimCache(cache);
              });
            }
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});

// Old content-hashed chunks accumulate across deploys; keep the cache bounded.
const MAX_STATIC_ENTRIES = 120;
async function trimCache(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_STATIC_ENTRIES; i++) {
    await cache.delete(keys[i]);
  }
}
