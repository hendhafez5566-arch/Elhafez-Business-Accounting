const cacheName = 'elhafez-PROOF-shell-v1';
const shell = ['/', '/browser-client.mjs', '/register-worker.mjs'];
globalThis.addEventListener('install', event => event.waitUntil(globalThis.caches.open(cacheName).then(cache => cache.addAll(shell)).then(() => globalThis.skipWaiting())));
globalThis.addEventListener('activate', event => event.waitUntil(globalThis.clients.claim()));
globalThis.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== globalThis.location.origin || !shell.includes(url.pathname)) return;
  event.respondWith(globalThis.caches.open(cacheName).then(cache => cache.match(url.pathname)).then(cached => cached || fetch(event.request)));
});
