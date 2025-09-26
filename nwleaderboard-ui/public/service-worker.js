const CACHE_NAME = 'nwleaderboard-cache-__VERSION__';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/config/config.js',
  '/version.txt',
  '/css/main.css',
  '/js/App.js',
  '/js/BottomNav.js',
  '/js/VersionChecker.js',
  '/js/auth.js',
  '/js/i18n.js',
  '/js/index.js',
  '/js/theme.js',
  '/js/locales/en.js',
  '/js/locales/fr.js',
  '/js/pages/Home.js',
  '/js/pages/Login.js',
  '/js/pages/Register.js',
  '/js/pages/ForgotPassword.js',
  '/js/pages/Preferences.js',
  '/js/pages/Password.js',
  // __IMAGES__
  // __SOUNDS__
];

function postToClients(message) {
  return self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => client.postMessage(message));
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      let successCount = 0;
      await postToClients({ type: 'CACHE_INIT', total: ASSETS.length });
      for (const [index, asset] of ASSETS.entries()) {
        await postToClients({ type: 'CACHE_START', asset });
        try {
          await cache.add(asset);
          successCount++;
        } catch {
          console.warn(`Failed to cache ${asset}`);
        }
        await postToClients({ type: 'CACHE_UPDATE', loaded: index + 1, total: ASSETS.length });
      }
      await postToClients({ type: 'CACHE_SUMMARY', success: successCount, total: ASSETS.length });
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll().then((clients) =>
          clients.forEach((client) => client.postMessage('CACHE_COMPLETE'))
        )
      )
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    const requestURL = new URL(event.request.url);
    if (requestURL.origin === self.location.origin) {
      event.respondWith(
        (async () => {
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match('/index.html');
          if (cachedResponse) {
            event.waitUntil(
              (async () => {
                try {
                  const freshResponse = await fetch('/index.html', { cache: 'no-store' });
                  if (freshResponse && freshResponse.ok) {
                    await cache.put('/index.html', freshResponse.clone());
                  }
                } catch (error) {
                  console.warn('Failed to refresh index.html from network', error);
                }
              })()
            );
            return cachedResponse.clone();
          }

          try {
            const networkResponse = await fetch('/index.html');
            if (networkResponse && networkResponse.ok) {
              await cache.put('/index.html', networkResponse.clone());
              return networkResponse;
            }
            return networkResponse;
          } catch (error) {
            console.error('Network error fetching index.html for navigation', error);
            throw error;
          }
        })()
      );
    } else {
      event.respondWith(fetch(event.request));
    }
    event.waitUntil(
      (async () => {
        const client = await self.clients.get(event.clientId);
        if (client) {
          client.postMessage('CACHE_COMPLETE');
        }
      })()
    );
    return;
  }
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }
  if (!event.request.url.startsWith(self.location.origin)) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (!response) {
        const path = new URL(event.request.url).pathname;
        if (ASSETS.includes(path)) {
          console.warn(`Cache miss for ${path}`);
        }
      }
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'New World Leaderboard';
  const options = {
    body: data.body || '',
    icon: '/images/icons/logo.svg',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
