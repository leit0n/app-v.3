const CACHE_NAME = 'guardioes-shell-v1';
const SHELL_FILES = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  '/router/router.js',
  '/state/store.js',
  '/state/state.js',
  '/state/storage.js',
  '/state/uuid.js',
  '/ui/dom.js',
  '/screens/screen-home.js',
  '/screens/screen-map.js',
  '/screens/screen-report.js',
  '/screens/screen-challenges.js',
  '/screens/screen-profile.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Never cache API calls (they must always hit the network for live data);
// for everything else, try the network first and fall back to the cached shell.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
  );
});
