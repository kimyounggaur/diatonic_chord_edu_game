/* Versioned same-origin, runtime-only cache. An authenticated page must first load online. */
const CACHE = 'tonterra-offline-v1';
const ASSET = /\.(?:js|css|svg|png|webp|woff2?|webmanifest)$/i;
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('tonterra-offline-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || /(?:auth|login|logout|oauth|callback|api)\b/i.test(url.pathname) || request.headers.has('authorization')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async response => {
      // Do not cache redirects, authentication shells or pages other than this app.
      if (response.ok && !response.redirected && response.type === 'basic' && response.headers.get('content-type')?.includes('text/html')) {
        const text = await response.clone().text();
        if (text.includes('tonterra-app')) {
          const cache = await caches.open(CACHE);
          await cache.put('/', response.clone());
        }
      }
      return response;
    }).catch(async () => (await caches.match('/')) || new Response('처음 실행할 때는 인터넷에 연결해 주세요. 이미 열어 둔 게임의 진행은 기기에 저장됩니다.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })));
    return;
  }
  if (!ASSET.test(url.pathname)) return;
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(async response => {
    if (response.ok && !response.redirected && response.type === 'basic') {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  })));
});
