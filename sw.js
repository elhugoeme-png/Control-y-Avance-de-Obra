/* Service worker: guarda la app para abrirla sin señal en obra.
   Sube la versión de CACHE cuando publiques cambios. */
const CACHE = 'jcc-obra-v1';
const ARCHIVOS = [
  './', './index.html', './css/styles.css', './manifest.webmanifest', './icon.svg',
  './js/calc.js', './js/store.js', './js/ui.js', './js/fotos.js', './js/app.js',
  './js/views/tablero.js', './js/views/asistencia.js', './js/views/diario.js', './js/views/programa.js',
  './js/views/inventario.js', './js/views/reporte.js', './js/views/ajustes.js',
];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
// Red primero (para tener la última versión), caché si no hay señal.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); return r; }).catch(() => caches.match(e.request)));
});
