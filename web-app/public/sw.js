// PDF2SVG — Service Worker for offline/PWA support
// Uses a network-first strategy: always tries the network first, falls back to cache.
// This works correctly with Vite's hashed asset filenames in production builds.
const CACHE_NAME = 'pdf2svg-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests from our own origin
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip non-HTTP(S) protocols (e.g. chrome-extension://)
  if (!url.protocol.startsWith('http')) return;

  // Skip MuPDF WASM files — they are large and change with version updates
  if (url.pathname.includes('mupdf')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for static assets (JS, CSS, WOFF, SVG, images)
        if (response.ok && response.status === 200) {
          const contentType = response.headers.get('content-type') || '';
          const isCacheable =
            contentType.includes('javascript') ||
            contentType.includes('css') ||
            contentType.includes('font') ||
            contentType.includes('image') ||
            url.pathname.endsWith('.html') ||
            url.pathname.endsWith('.wasm');

          if (isCacheable) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
        }
        return response;
      })
      .catch(() => {
        // Network failed — try the cache
        return caches.match(event.request).then((cached) => {
          return cached || new Response('Offline', { status: 503 });
        });
      })
  );
});
