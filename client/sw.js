const CACHE_NAME = 'facelook-cache-v2';

// Install Event: Pre-cache some important assets if needed
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        '/',
        '/index.html.html',
        '/assets/images/facelook_update_final-Photoroom.png'
      ]);
    })
  );
  self.skipWaiting();
});

// Activate Event: Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Stale-While-Revalidate Strategy
self.addEventListener('fetch', event => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;
  
  // Exclude some requests if needed (e.g. browser extensions)
  if (!event.request.url.startsWith('http') && !event.request.url.startsWith('https')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const fetchedResponse = fetch(event.request).then(networkResponse => {
          // Put the new response in cache if it's a valid response
          if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // If network fetch fails, do nothing (will just return cached response below if available)
        });

        // Return cached response immediately if available, otherwise wait for network
        return cachedResponse || fetchedResponse;
      });
    })
  );
});
