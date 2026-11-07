// Offline-first service worker (SPEC §3). App shell: stale-while-revalidate, so a new
// deploy lands on the next launch. OCR engine + language data: cache-first, precached.
const VERSION = 'v1';
const SHELL = `wallet-shell-${VERSION}`;
const OCR = 'wallet-ocr-v5';

const SHELL_FILES = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css', './css/settings.css',
  './js/main.js', './js/constants.js', './js/store.js', './js/images.js', './js/card.js',
  './js/passview.js', './js/organizer.js', './js/builder.js', './js/generate.js', './js/ocr.js',
  './js/ui.js', './js/glitch.js',
  './fixtures/default-config.json',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];
const OCR_FILES = [
  './vendor/tesseract/tesseract.min.js',
  './vendor/tesseract/worker.min.js',
  './vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js',
  './vendor/tesseract/core/tesseract-core-lstm.wasm.js',
  './vendor/tesseract/lang/eng.traineddata.gz',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    await shell.addAll(SHELL_FILES);
    const ocr = await caches.open(OCR);
    await Promise.all(OCR_FILES.map(async (u) => {
      if (!(await ocr.match(u))) { try { await ocr.add(u); } catch { /* retried at runtime */ } }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== SHELL && k !== OCR) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.includes('/vendor/tesseract/')) {
    e.respondWith((async () => {
      const c = await caches.open(OCR);
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    })());
    return;
  }

  e.respondWith((async () => {
    const c = await caches.open(SHELL);
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (req.mode === 'navigate') return (await c.match('./index.html')) || Response.error();
    return Response.error();
  })());
});
