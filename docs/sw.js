// Service worker de Power Tracker.
// - App shell (html/css/js/iconos): cache-first (funciona sin cobertura en el gym).
// - JSON del plan: network-first con fallback a cache (asi ves los cambios del
//   entrenador cuando hay red, pero la app sigue si no la hay).

const VERSION = 'power-v1';
const SHELL = [
  '.',
  'index.html',
  'manifest.json',
  'css/estilo.css',
  'js/app.js',
  'js/almacen.js',
  'js/progresion.js',
  'js/temporizador.js',
  'js/adherencia.js',
  'js/resumen.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((c) => c !== VERSION).map((c) => caches.delete(c))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const esPlan = url.pathname.includes('/plan/') && url.pathname.endsWith('.json');

  if (esPlan) {
    // network-first
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(VERSION).then((c) => c.put(req, copia));
          return resp;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }

  // cache-first para el resto (app shell)
  event.respondWith(
    caches.match(req).then((cacheado) => {
      if (cacheado) return cacheado;
      return fetch(req).then((resp) => {
        if (resp.ok && url.origin === self.location.origin) {
          const copia = resp.clone();
          caches.open(VERSION).then((c) => c.put(req, copia));
        }
        return resp;
      });
    }),
  );
});
