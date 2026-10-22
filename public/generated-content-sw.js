// Standalone page worker. Scope: /generated-content-app only. Touches only its own cache.
const CACHE = 'generated-content-v1';
const B = new URL('./', self.location).pathname;
const PATHS = ['generated-content-app', 'generated-content-app.html', 'generated-content-manifest.webmanifest', 'generated-content-odyssey.svg'].map(p => B + p);
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('generated-content-') && k !== CACHE).map(k => caches.delete(k)))));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !PATHS.includes(u.pathname)) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && !r.redirected) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
