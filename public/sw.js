const CACHE_VERSION = 'v1.0.1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;

// Cache strategies
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico'
];

const CACHE_STRATEGIES = {
  // Images and static assets - Cache First
  images: 'cache-first',
  // API calls - Network First with fallback
  api: 'network-first',
  // HTML pages - Stale While Revalidate
  pages: 'stale-while-revalidate',
  // CSS/JS - Cache First
  assets: 'cache-first'
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Error caching static assets:', error);
      })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && cacheName !== API_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-HTTP requests
  if (!request.url.startsWith('http')) return;

  // Determine cache strategy based on request
  let strategy = 'network-first'; // default

  if (request.destination === 'image' || request.url.includes('.png') || request.url.includes('.jpg')) {
    strategy = CACHE_STRATEGIES.images;
  } else if (request.url.includes('/api/')) {
    strategy = CACHE_STRATEGIES.api;
  } else if (request.destination === 'document') {
    strategy = CACHE_STRATEGIES.pages;
  } else if (request.destination === 'style' || request.destination === 'script') {
    strategy = CACHE_STRATEGIES.assets;
  }

  // Apply strategy
  switch (strategy) {
    case 'cache-first':
      event.respondWith(cacheFirst(request));
      break;
    case 'network-first':
      event.respondWith(networkFirst(request));
      break;
    case 'stale-while-revalidate':
      event.respondWith(staleWhileRevalidate(request));
      break;
    default:
      event.respondWith(fetch(request));
  }
});

// Cache First Strategy
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Cache first failed:', error);
    return new Response('Offline content not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Network First Strategy (for API calls)
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache');
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Stale While Revalidate Strategy (for pages)
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        caches.open(DYNAMIC_CACHE)
          .then((cache) => cache.put(request, response.clone()));
      }
      return response;
    })
    .catch((error) => {
      console.error('[SW] Stale while revalidate failed:', error);
      return cached;
    });

  return cached || fetchPromise;
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Handle offline actions when connection is restored
  console.log('[SW] Performing background sync');
  // Implementation would depend on your specific offline requirements
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      vibrate: [200, 100, 200],
      data: data.data || {}
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});