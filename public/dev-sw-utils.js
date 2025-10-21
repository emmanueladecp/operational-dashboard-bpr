// Development utilities for service worker debugging
// This file can be loaded in the browser console for debugging service worker cache issues

(function() {
  'use strict';

  window.SWDebugUtils = {

    // Clear all service worker caches
    clearAllCaches: function() {
      return new Promise((resolve, reject) => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          console.log('[SW Debug] Sending cache clear request to service worker...');
          const messageChannel = new MessageChannel();

          messageChannel.port1.onmessage = function(event) {
            if (event.data.type === 'CACHE_CLEARED') {
              console.log('[SW Debug] Cache cleared successfully:', event.data);
              resolve(event.data);
            } else {
              console.warn('[SW Debug] Unexpected message:', event.data);
              resolve(event.data);
            }
          };

          messageChannel.port1.onmessageerror = function(error) {
            console.error('[SW Debug] Message error:', error);
            reject(error);
          };

          navigator.serviceWorker.controller.postMessage({
            type: 'CLEAR_CACHE'
          }, [messageChannel.port2]);
        } else {
          console.warn('[SW Debug] No active service worker found');
          resolve({ error: 'No active service worker' });
        }
      });
    },

    // Get cache information
    getCacheInfo: function() {
      return new Promise((resolve) => {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'GET_CACHE_INFO'
          });

          // Listen for response (you'll need to add this handler to your SW)
          navigator.serviceWorker.addEventListener('message', function handleCacheInfo(event) {
            if (event.data && event.data.type === 'CACHE_INFO') {
              navigator.serviceWorker.removeEventListener('message', handleCacheInfo);
              resolve(event.data);
            }
          });

          // Timeout after 5 seconds
          setTimeout(() => {
            navigator.serviceWorker.removeEventListener('message', handleCacheInfo);
            resolve({ error: 'Timeout waiting for cache info' });
          }, 5000);
        } else {
          resolve({ error: 'No active service worker' });
        }
      });
    },

    // Force service worker update
    updateServiceWorker: function() {
      return new Promise((resolve, reject) => {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistration().then((registration) => {
            if (registration) {
              console.log('[SW Debug] Forcing service worker update...');
              registration.update().then(() => {
                console.log('[SW Debug] Service worker update check completed');
                resolve({ success: true });
              }).catch(reject);
            } else {
              console.warn('[SW Debug] No service worker registration found');
              resolve({ error: 'No service worker registration' });
            }
          }).catch(reject);
        } else {
          resolve({ error: 'Service workers not supported' });
        }
      });
    },

    // Unregister service worker (nuclear option)
    unregisterServiceWorker: function() {
      return new Promise((resolve, reject) => {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistration().then((registration) => {
            if (registration) {
              console.log('[SW Debug] Unregistering service worker...');
              registration.unregister().then((success) => {
                if (success) {
                  console.log('[SW Debug] Service worker unregistered successfully');
                  resolve({ success: true });
                } else {
                  console.warn('[SW Debug] Service worker unregistration returned false');
                  resolve({ success: false });
                }
              }).catch(reject);
            } else {
              console.warn('[SW Debug] No service worker registration found');
              resolve({ error: 'No service worker registration' });
            }
          }).catch(reject);
        } else {
          resolve({ error: 'Service workers not supported' });
        }
      });
    },

    // Quick debug function - clears cache and updates SW
    debugAndRefresh: function() {
      console.log('[SW Debug] Starting debug and refresh process...');
      return this.clearAllCaches()
        .then(() => this.updateServiceWorker())
        .then(() => {
          console.log('[SW Debug] Debug process completed. Refresh the page to see changes.');
          return { success: true };
        })
        .catch((error) => {
          console.error('[SW Debug] Debug process failed:', error);
          return { error: error.message };
        });
    }
  };

  // Auto-run some debug info on load
  console.log('[SW Debug] Service Worker Debug Utils loaded!');
  console.log('[SW Debug] Available commands:');
  console.log('[SW Debug] - SWDebugUtils.clearAllCaches()');
  console.log('[SW Debug] - SWDebugUtils.getCacheInfo()');
  console.log('[SW Debug] - SWDebugUtils.updateServiceWorker()');
  console.log('[SW Debug] - SWDebugUtils.unregisterServiceWorker()');
  console.log('[SW Debug] - SWDebugUtils.debugAndRefresh()');

  // Show current service worker status
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration) {
        console.log('[SW Debug] Active service worker:', registration.scope);
        if (registration.active) {
          console.log('[SW Debug] Service worker state:', registration.active.state);
        }
      } else {
        console.log('[SW Debug] No active service worker registration');
      }
    });
  }

})();