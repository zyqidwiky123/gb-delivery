/* 
   ARO DRIVE - Service Worker Kill Switch 
   This script unregisters itself and clears all caches to fix the 
   "Landing Page hijacked by old App" issue.
*/

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Unregister this and any other service worker
  self.registration.unregister()
    .then(() => self.clients.matchAll())
    .then((clients) => {
      clients.forEach(client => {
        if (client.url && 'navigate' in client) {
          client.navigate(client.url);
        }
      });
    });
  
  // Clear all caches
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    })
  );
});
