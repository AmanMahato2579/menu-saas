self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'MenuQR', message: 'You have a new notification.', link: '/admin/notifications' };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.message = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.message,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.link || 'menuqr-notification',
      renotify: true,
      data: { link: data.link || '/admin/notifications' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/admin/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(link) && 'focus' in client) {
          return client.focus();
        }
      }
      for (const client of clientList) {
        if ('focus' in client && 'navigate' in client) {
          client.focus();
          return client.navigate(link);
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(link);
      }
    })
  );
});
