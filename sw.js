/* i-Study service worker: precache app shell + built-in content; network-first so updates arrive. */
const CACHE = 'istudy-v11';
const CORE = ['./', 'index.html', 'tailwind.css', 'app.js', 'tools-far2.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'content/index.json', 'content/ai-prompt.txt', 'content/template.json'];
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    try { const idx = await (await fetch('content/index.json', { cache: 'no-cache' })).json(); await c.addAll(idx.subjects.flatMap(s => s.chapters.map(f => 'content/' + f))); } catch (err) {}
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request).then(m => m || caches.match('index.html'))));
});
