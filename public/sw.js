/*
 * Gaskin service worker: cache the app shell so Gaskin opens with no internet.
 *
 * Deliberately small and harmless:
 * - Only same-origin GET requests are cached. AI calls, SMS gateways, map tiles and anything
 *   cross-origin go straight to the network and are never stored.
 * - Patient data is never in the cache: it lives in IndexedDB or the chosen folder.
 * - Navigations are network-first (so updates arrive), falling back to the cached page offline.
 * - Static files are cache-first, refreshed in the background.
 * - Bump VERSION to drop old caches.
 * The page registers this file only over http(s) and never in an iframe or from file://.
 */
const VERSION = 'gaskin-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('gaskin-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put('./index.html', copy)).catch(() => undefined);
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./'))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => undefined);
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    }),
  );
});
