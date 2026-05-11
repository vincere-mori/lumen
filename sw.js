// LUMEN Service Worker
// Strategy:
//   * HTML / navigation → network-first (so updates ship instantly)
//   * Static assets (JS, CSS, fonts, images) → cache-first w/ background revalidate
const CACHE = 'lumen-v12';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  'vendor/react.js',
  'vendor/react-dom.js',
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=Spectral:ital,wght@0,300;0,400;1,300;1,400&family=Inter:wght@400;500&display=swap'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isHtmlRequest(req) {
  if (req.mode === 'navigate') return true;
  const url = new URL(req.url);
  if (url.pathname === '/' || url.pathname.endsWith('/')) return true;
  if (url.pathname.endsWith('.html')) return true;
  const accept = req.headers.get('accept') || '';
  return accept.includes('text/html');
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Network-first for HTML so deploys propagate instantly
  if (isHtmlRequest(req)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for everything else (with revalidation in background)
  e.respondWith(
    caches.match(req).then((cached) => {
      const fetcher = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetcher;
    })
  );
});
