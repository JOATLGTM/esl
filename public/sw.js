/*
 * Service worker (docs/ROADMAP.md #10).
 *
 * Two jobs, and deliberately no more:
 *
 *   1. Cache-first for audio, images and built assets. Audio filenames are
 *      content hashes, so a cached clip can never be stale; serving it from
 *      here costs zero edge requests, which is the constraint DEPLOY.md says
 *      binds first. Day 2 of a unit should touch the network only for data.
 *
 *   2. "Save this unit": the page posts a list of URLs and this fetches them
 *      into the cache, so a learner on a data plan can pull a unit on wifi and
 *      practise on the bus.
 *
 * Pages and data are NOT cached. The session is server state -- the stage,
 * the cards due, the reviews written one at a time -- and a stale page here
 * would be a learner told the wrong thing with confidence. Offline, the app
 * says so honestly (the existing /pausa and error pages) rather than pretend.
 */
const CACHE = "hablar-media-v1";
const CACHEABLE = /^\/(audio|images)\//;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  const isMedia = CACHEABLE.test(url.pathname);
  const isBuilt = url.pathname.startsWith("/_next/static/");
  if (!isMedia && !isBuilt) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const res = await fetch(event.request);
      // Range requests come back 206 and are not cacheable as a whole file;
      // the player's first full fetch is what lands in the cache.
      if (res.ok && res.status === 200) cache.put(event.request, res.clone());
      return res;
    }),
  );
});

// { type: "precache", urls: [...] } -> replies with { done, failed } on the port.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "precache" || !Array.isArray(data.urls)) return;
  const port = event.ports && event.ports[0];
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      let done = 0;
      let failed = 0;
      for (const url of data.urls) {
        try {
          if (await cache.match(url)) {
            done++;
            continue;
          }
          const res = await fetch(url);
          if (res.ok) {
            await cache.put(url, res);
            done++;
          } else failed++;
        } catch {
          failed++;
        }
      }
      if (port) port.postMessage({ done, failed });
    }),
  );
});
