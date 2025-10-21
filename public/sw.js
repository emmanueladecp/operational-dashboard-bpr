const CACHE_VERSION = 'v1.0.2';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;

// Debug logging for development
const DEBUG_MODE = true;
const debugLog = (message, data = null) => {
  if (DEBUG_MODE) {
    console.log(`[SW Debug] ${new Date().toISOString()}: ${message}`, data ? data : '');
  }
};

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
  debugLog('Installing service worker', {
    cacheVersion: CACHE_VERSION,
    staticCache: STATIC_CACHE,
    dynamicCache: DYNAMIC_CACHE,
    apiCache: API_CACHE,
    staticAssets: STATIC_ASSETS
  });

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        debugLog('Caching static assets', { cacheName: STATIC_CACHE });
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        debugLog('Static assets cached successfully', { cacheName: STATIC_CACHE });
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Error caching static assets:', error);
        debugLog('Error caching static assets', { error: error.message });
      })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  debugLog('Activating service worker', {
    cacheVersion: CACHE_VERSION,
    expectedCaches: [STATIC_CACHE, DYNAMIC_CACHE, API_CACHE]
  });

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        debugLog('Found existing caches', { cacheNames, count: cacheNames.length });
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && cacheName !== API_CACHE) {
              debugLog('Deleting old cache', { cacheName });
              return caches.delete(cacheName);
            } else {
              debugLog('Keeping current cache', { cacheName });
            }
          })
        );
      })
      .then((deletedCaches) => {
        const deletedCount = deletedCaches.filter(Boolean).length;
        debugLog('Cache cleanup completed', { deletedCount });
        return self.clients.claim();
      })
      .then(() => {
        debugLog('Service worker activated and claimed all clients');
      })
      .catch((error) => {
        console.error('[SW] Activation error:', error);
        debugLog('Activation error', { error: error.message });
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-HTTP requests
  if (!request.url.startsWith('http')) {
    debugLog('Skipping non-HTTP request', { url: request.url });
    return;
  }

  // Skip service worker internal communication and browser extension requests
  if (request.url.includes('chrome-extension://') ||
      request.url.includes('moz-extension://') ||
      request.url.includes('safari-extension://') ||
      request.url.includes('localhost:3000/sw.js') ||
      request.url.endsWith('/sw.js')) {
    debugLog('Skipping service worker internal request', { url: request.url });
    return;
  }

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

  debugLog('Fetch request', {
    url: request.url,
    method: request.method,
    destination: request.destination,
    strategy: strategy,
    mode: request.mode,
    credentials: request.credentials
  });

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
      debugLog('No strategy matched, using direct fetch', { url: request.url });
      event.respondWith(fetch(request));
  }
});

// Cache First Strategy
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    debugLog('Cache hit - serving from cache', {
      url: request.url,
      cache: DYNAMIC_CACHE,
      cached: true
    });
    return cached;
  }

  debugLog('Cache miss - fetching from network', {
    url: request.url,
    cache: DYNAMIC_CACHE,
    cached: false
  });

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
      debugLog('Cached response for future use', {
        url: request.url,
        cache: DYNAMIC_CACHE
      });
    }
    return response;
  } catch (error) {
    console.error('[SW] Cache first failed:', error);
    debugLog('Cache first strategy failed', {
      url: request.url,
      error: error.message
    });
    return new Response('Offline content not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Network First Strategy (for API calls)
async function networkFirst(request) {
  console.log('[SW] Network first request:', {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    mode: request.mode,
    credentials: request.credentials
  });

  try {
    const response = await fetch(request);
    console.log('[SW] Network response:', {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      type: response.type,
      url: response.url
    });

    if (response.ok) {
      // Only cache GET and HEAD requests - Cache API doesn't support other methods
      if (request.method === 'GET' || request.method === 'HEAD') {
        try {
          console.log('[SW] Attempting to cache response for:', request.method, request.url);
          const cache = await caches.open(API_CACHE);
          await cache.put(request, response.clone());
          console.log('[SW] Successfully cached response');
        } catch (cacheError) {
          console.error('[SW] Cache error details:', {
            name: cacheError.name,
            message: cacheError.message,
            stack: cacheError.stack
          });
        }
      } else {
        console.log('[SW] Skipping cache for non-cacheable method:', request.method);
      }
    }
    return response;
  } catch (error) {
    console.error('[SW] Network error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    console.log('[SW] Network failed, trying cache for:', request.method, request.url);
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

// Development helper functions (available on self for debugging)
self.clearAllCaches = async () => {
  debugLog('Manual cache clearing requested');
  const cacheNames = await caches.keys();
  debugLog('Found caches for manual clearing', { cacheNames });

  const results = await Promise.all(
    cacheNames.map(async (cacheName) => {
      const deleted = await caches.delete(cacheName);
      if (deleted) {
        debugLog('Manually deleted cache', { cacheName });
      }
      return deleted;
    })
  );

  const deletedCount = results.filter(Boolean).length;
  debugLog('Manual cache clearing completed', { deletedCount, totalCaches: results.length });
  return { deletedCount, totalCaches: results.length };
};

// Development cache clearing mechanism
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    debugLog('Received cache clear request', { source: event.source?.url });

    // Use a timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Cache clearing timeout'));
      }, 5000); // 5 second timeout
    });

    const clearCachePromise = caches.keys()
      .then((cacheNames) => {
        debugLog('Clearing all caches for development', { cacheNames });
        return Promise.all(
          cacheNames.map((cacheName) => {
            debugLog('Deleting cache', { cacheName });
            return caches.delete(cacheName);
          })
        );
      })
      .then((results) => {
        const deletedCount = results.filter(Boolean).length;
        debugLog('Cache clearing completed', { deletedCount, totalCaches: results.length });

        // Respond back to the main thread immediately
        if (event.source && event.source.postMessage) {
          event.source.postMessage({
            type: 'CACHE_CLEARED',
            deletedCount: deletedCount,
            timestamp: new Date().toISOString(),
            success: true
          });
        }

        return self.skipWaiting();
      })
      .then(() => {
        debugLog('Service worker skipWaiting completed');
      })
      .catch((error) => {
        console.error('[SW] Cache clearing error:', error);
        debugLog('Cache clearing error', { error: error.message });

        // Send error response back to main thread
        if (event.source && event.source.postMessage) {
          event.source.postMessage({
            type: 'CACHE_CLEARED',
            error: error.message,
            timestamp: new Date().toISOString(),
            success: false
          });
        }
        throw error;
      });

    // Race between cache clearing and timeout
    event.waitUntil(Promise.race([clearCachePromise, timeoutPromise]));
  }
});