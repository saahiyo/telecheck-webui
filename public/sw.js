const CACHE_NAME = 'telecheck-pro-v2'; // Bumped version to force update
const ASSETS_TO_CACHE = [
  '/site.webmanifest',
  '/favicon.ico',
  '/icon.svg',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Instantly activate new service worker
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  // Clean up old caches when a new service worker takes over
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('telecheck-pro-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass non-HTTP(S) requests (like chrome-extension://)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Bypass Next.js internal data requests (RSC payloads), API routes, and build assets
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/api/') ||
    event.request.headers.get('rsc') === '1' ||
    event.request.method !== 'GET'
  ) {
    return; // Let the browser handle these normally
  }

  // Network-First strategy for standard page navigations and other assets
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache the fresh response for future offline use
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if offline
        return caches.match(event.request);
      })
  );
});
