/* ============================================================
   OPS Dashboard GG v5 — Service Worker
   Autor: Gustavo Gallego | © 2024-2026
   ============================================================ */

const CACHE_NAME   = 'ops-gg-v5-cache-v1';
const OFFLINE_PAGE = './OPS_Dashboard_GG_v5_secure.html';

// Recursos locales que se cachean al instalar
const LOCAL_ASSETS = [
  './OPS_Dashboard_GG_v5_secure.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// CDN resources cacheadas para uso offline
const CDN_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&family=Exo+2:wght@300;400;600;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// ── INSTALL: cachear todo al instalar ──────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Cachear assets locales (crítico)
      await cache.addAll(LOCAL_ASSETS);
      // Cachear CDN (no crítico, ignorar fallos)
      const cdnResults = await Promise.allSettled(
        CDN_ASSETS.map(url =>
          fetch(url, { mode: 'cors' })
            .then(res => res.ok ? cache.put(url, res) : Promise.reject())
            .catch(() => {})
        )
      );
      console.log('[SW] Instalado — OPS Dashboard GG v5');
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: limpiar cachés viejos ───────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Eliminando caché antigua:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: cache-first para assets, network-first para datos ──
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Solo manejar GET
  if (event.request.method !== 'GET') return;

  // Estrategia: Cache First → Network → Offline page
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          // Cachear respuestas válidas de CDN y locales
          if (response && response.status === 200) {
            const shouldCache =
              url.includes('cdnjs.cloudflare.com') ||
              url.includes('fonts.googleapis.com') ||
              url.includes('fonts.gstatic.com') ||
              url.endsWith('.html') ||
              url.endsWith('.json') ||
              url.endsWith('.png');

            if (shouldCache) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
          }
          return response;
        })
        .catch(() => {
          // Sin red y sin caché → offline page
          if (event.request.destination === 'document') {
            return caches.match(OFFLINE_PAGE);
          }
        });
    })
  );
});

// ── MESSAGE: forzar actualización desde la app ────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
