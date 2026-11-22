/* Service worker: cache-first untuk cangkang aplikasi, jaringan langsung untuk API GAS. */
const VERSION = 'hrga-v1.0.0';
const SHELL = [
  './', 'index.html', 'manifest.json', 'css/style.css',
  'js/config.js', 'js/api.js', 'js/ui.js', 'js/views-main.js', 'js/views-more.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon.svg'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // API GAS & Google: tidak di-cache
  // stale-while-revalidate untuk berkas statis: tampil instan, diperbarui di belakang layar
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
