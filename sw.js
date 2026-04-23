/* ═══════════════════════════════════════
   MN OILS — Service Worker v3
   Scope: /mn_oils_pwa/
   ═══════════════════════════════════════ */

const CACHE_NAME = 'mn-oils-v3';
const STATIC_ASSETS = [
  '/mn_oils_pwa/',
  '/mn_oils_pwa/index.html',
  '/mn_oils_pwa/manifest.json',
  '/mn_oils_pwa/icon-192.png',
  '/mn_oils_pwa/icon-512.png',
];

/* ── INSTALL: pre-cache static shell ── */
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache partial failure:', err);
      });
    })
  );
});

/* ── ACTIVATE: clean old caches ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(
        keyList
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH: Network-first for HTML, Cache-first for assets ── */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Skip non-GET and cross-origin (except fonts)
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isSameOrigin = url.origin === location.origin;
  const isFontReq = url.hostname.includes('fonts.googleapis.com') ||
                    url.hostname.includes('fonts.gstatic.com');

  if (!isSameOrigin && !isFontReq) return;

  const isHTML = req.headers.get('accept')?.includes('text/html');

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      if (isHTML) {
        // Network-first for HTML pages
        try {
          const networkResp = await fetch(req);
          if (networkResp && networkResp.ok) {
            cache.put(req, networkResp.clone()).catch(() => {});
          }
          return networkResp;
        } catch {
          const cached = await cache.match(req)
            || await cache.match('/mn_oils_pwa/')
            || await cache.match('/mn_oils_pwa/index.html');
          return cached || new Response(
            '<h1>أنت غير متصل بالإنترنت</h1>',
            { status: 503, headers: { 'Content-Type': 'text/html;charset=utf-8' } }
          );
        }
      } else {
        // Cache-first for assets (fonts, images, etc.)
        const cached = await cache.match(req);
        if (cached) return cached;

        try {
          const networkResp = await fetch(req);
          if (networkResp && networkResp.ok) {
            cache.put(req, networkResp.clone()).catch(() => {});
          }
          return networkResp;
        } catch {
          return new Response('', { status: 404 });
        }
      }
    })()
  );
});
