// Service Worker for Firebase Cloud Messaging & Web Push Notifications - Basmah Tech
/* eslint-disable no-restricted-globals */

self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log('[FCM-SW] Firebase Messaging Service Worker installed.');
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  console.log('[FCM-SW] Firebase Messaging Service Worker activated.');
});

// Push Event Listener - Triggered when backend sends an FCM / WebPush message
self.addEventListener('push', (event) => {
  console.log('[FCM-SW] Push event received:', event);

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
      console.log('[FCM-SW] Push payload parsed as JSON:', dataJson);

      // Extract from standard WebPush or FCM format
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
      console.log('[FCM-SW] Push payload parsed as text:', rawText);
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
      // 1. Show native OS notification (Works on Android, Windows, macOS, iOS 16.4+ PWA)
      self.registration.showNotification(payload.title, notificationOptions),
      
      // 2. Inform any open client window to play sound & refresh live data
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

// Notification Click Listener - Opens or focuses the application
self.addEventListener('notificationclick', (event) => {
  console.log('[FCM-SW] Notification click received:', event.action);
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open, focus it
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
