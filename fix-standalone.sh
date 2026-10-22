#!/usr/bin/env bash
# Fixes the standalone page's resource paths and service worker. Does not commit.
# Run from the repo root:  bash fix-standalone.sh
set -euo pipefail
[ -d public ] || { echo "public/ (lowercase) not found. Finish the Public -> public case fix first."; exit 1; }
for f in generated-content-app.html generated-content-sw.js generated-content-manifest.webmanifest generated-content-odyssey.svg study-plan-only.html; do
  if [ -f "$f" ]; then git mv "$f" "public/$f"; fi
  [ -f "public/$f" ] || { echo "Missing $f"; exit 1; }
done

cat > public/generated-content-sw.js <<'EOF'
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
EOF

cat > public/generated-content-manifest.webmanifest <<'EOF'
{"name":"UPSC Odyssey + Study Plan","short_name":"UPSC","id":"./generated-content-app.html","start_url":"./generated-content-app.html","scope":"./generated-content-app","display":"standalone","background_color":"#111918","theme_color":"#111918","icons":[{"src":"generated-content-odyssey.svg","sizes":"any","type":"image/svg+xml","purpose":"any maskable"}]}
EOF

python3 - <<'EOF'
p='public/generated-content-app.html'
h=open(p,encoding='utf-8').read()
def rep(a,b,n):
    global h
    assert h.count(a)==n,(a,h.count(a))
    h=h.replace(a,b)
rep('<link rel="manifest" href="manifest.webmanifest">','<link rel="manifest" href="generated-content-manifest.webmanifest">',1)
rep('href="odyssey.svg"','href="generated-content-odyssey.svg"',2)
rep("<script>if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js')</script>",
    "<script>if('serviceWorker' in navigator)navigator.serviceWorker.register('generated-content-sw.js',{scope:'./generated-content-app'}).catch(function(){})</script>",1)
open(p,'w',encoding='utf-8').write(h)
v=open('vite.config.ts').read()
a="navigateFallbackDenylist: [/^\\/api\\//],"
assert v.count(a)==1
g="globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],"
assert v.count(g)==1
v=v.replace(g,g+"\n        globIgnores: ['generated-content-*', 'study-plan-only.html'],")
open('vite.config.ts','w').write(v.replace(a,"navigateFallbackDenylist: [/^\\/api\\//, /^\\/generated-content-/, /^\\/study-plan-only/],"))
EOF
node --check public/generated-content-sw.js
python3 -c "import json;json.load(open('public/generated-content-manifest.webmanifest'))"
echo; git status --short; echo; git diff --stat HEAD -- vite.config.ts
echo "Done. Nothing committed. Next: npm test && npm run build && ls dist | grep -E 'generated|study-plan'"
