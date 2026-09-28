/* [F006][S005] PWA shell cache. API and authenticated pages stay network-only. */
const CACHE = "zomate-shell-v1";
const SHELL = ["/login", "/manifest.webmanifest", "/zomate-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== "GET" || requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname.startsWith("/api/") || !SHELL.includes(requestUrl.pathname)) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
