/* ============================================================
   DIARIO DE CAFE · service worker
   ------------------------------------------------------------
   Resuelve el problema mas grave de la version anterior: si el
   CDN de Supabase no respondia, la app quedaba en blanco.
   Ahora la libreria se guarda en cache la primera vez y la app
   abre igual sin conexion (art. 38).
   ============================================================ */

const VERSION = 'diario-cafe-v3-3';
const SHELL = [
  './',
  './index.html',
  './contenido.js',
  './datos.js',
  './motor.js',
  './app.js',
  './manifest.json'
];
const EXTERNOS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    // El shell es obligatorio; los externos son best-effort para no romper la instalacion.
    await c.addAll(SHELL);
    await Promise.allSettled(EXTERNOS.map(u => c.add(new Request(u, { mode: 'cors' }))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Las llamadas a la API y a auth NUNCA se cachean: siempre a la red.
  if (url.hostname.endsWith('supabase.co')) return;

  const esShell = url.origin === location.origin;
  const esExterno = EXTERNOS.some(u => req.url.startsWith(u)) ||
                    url.hostname === 'fonts.googleapis.com' ||
                    url.hostname === 'fonts.gstatic.com' ||
                    url.hostname === 'cdn.jsdelivr.net';

  if (!esShell && !esExterno) return;

  e.respondWith((async () => {
    const cache = await caches.open(VERSION);

    if (esShell) {
      // El codigo propio: red primero para que los cambios lleguen, cache como red de seguridad.
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') {
          const idx = await cache.match('./index.html');
          if (idx) return idx;
        }
        throw err;
      }
    }

    // Librerias y tipografias: cache primero, se actualizan en segundo plano.
    const hit = await cache.match(req);
    if (hit) {
      fetch(req).then(r => { if (r && r.ok) cache.put(req, r.clone()); }).catch(() => {});
      return hit;
    }
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  })());
});
