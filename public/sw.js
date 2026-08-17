// Service Worker for Basmah Tech PWA - Standalone & Offline Support
const CACHE_NAME = 'basmah-tech-pwa-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icon-192.png',
  '/icon-512.png'
];

// Install Event - Pre-cache critical static assets resiliently
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Pre-caching offline assets v3...');
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[SW] Caching warning for asset:', asset, err);
        }
      }
    })
  );
});

// Activate Event - Clean old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting legacy cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Handle network requests with fallback strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass SW for API routes, ADMS hardware communication, or non-GET requests
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/iclock') ||
    url.pathname.startsWith('/cdata') ||
    url.pathname.startsWith('/adms') ||
    url.pathname.startsWith('/lnk') ||
    url.pathname.startsWith('/link') ||
    url.pathname.startsWith('/devicecmd') ||
    url.pathname.startsWith('/getrequest')
  ) {
    return;
  }

  // Network-First for SPA HTML navigation requests (ensures fresh updates when online)
  if (request.mode === 'navigate' || (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match('/') || await cache.match('/index.html');
          return cached || (await cache.match('/offline.html')) || fetch(request);
        })
    );
    return;
  }

  // Stale-While-Revalidate for static assets (JS, CSS, Images, Fonts)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Push Notifications Listener (FCM & Web Push)
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);

  let payload = {
    title: '🔔 بصمة تك - إشعار حضور جديد',
    body: 'تم تسجيل بصمة حضور/انصراف جديدة.',
    icon: '/icon-192.png',
    badge: '/favicon.png',
    sound: '/notification.mp3',
    tag: 'basma-punch',
    data: { url: '/' }
  };

  if (event.data) {
    try {
      const dataJson = event.data.json();
      const notificationData = dataJson.notification || dataJson;
      payload.title = notificationData.title || dataJson.title || payload.title;
      payload.body = notificationData.body || dataJson.body || payload.body;
      payload.icon = notificationData.icon || dataJson.icon || '/icon-192.png';
      payload.badge = notificationData.badge || dataJson.badge || '/favicon.png';
      payload.sound = notificationData.sound || dataJson.sound || '/notification.mp3';
      payload.tag = dataJson.tag || `punch-${Date.now()}`;
      payload.data = dataJson.data || { url: dataJson.url || '/' };
    } catch (e) {
      const rawText = event.data.text();
      payload.body = rawText || payload.body;
    }
  }

  const notificationOptions = {
    body: payload.body,
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/favicon.png',
    tag: payload.tag || 'basma-punch',
    renotify: true,
    requireInteraction: true,
    vibrate: [250, 100, 250, 100, 250],
    data: payload.data || { url: '/' },
    actions: [
      { action: 'open', title: '👁️ فتح التطبيق' },
      { action: 'close', title: 'إغلاق' }
    ]
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title, notificationOptions),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({
            type: 'PUSH_NOTIFICATION_RECEIVED',
            payload: {
              title: payload.title,
              body: payload.body,
              data: payload.data
            }
          });
        }
      })
    ])
  );
});

// Notification Click Listener
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

