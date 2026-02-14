/* global self, URL */

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title =
    typeof payload.title === 'string' && payload.title.trim()
      ? payload.title
      : 'DevSuite inbox';
  const body =
    typeof payload.body === 'string' ? payload.body : 'New notification';
  const icon =
    typeof payload.icon === 'string' && payload.icon.trim()
      ? payload.icon
      : '/logo.svg';
  const tag =
    typeof payload.tag === 'string' && payload.tag.trim()
      ? payload.tag
      : 'devsuite-inbox';
  const url =
    typeof payload.url === 'string' && payload.url.trim()
      ? payload.url
      : '/inbox';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/favicon.svg',
      tag,
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const targetUrl =
    event.notification &&
    event.notification.data &&
    typeof event.notification.data.url === 'string'
      ? event.notification.data.url
      : '/inbox';

  event.waitUntil(
    (async () => {
      const target = new URL(targetUrl, self.location.origin);
      const clientsList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of clientsList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin !== target.origin) {
          continue;
        }

        if ('navigate' in client) {
          await client.navigate(target.href);
        }
        if ('focus' in client) {
          await client.focus();
        }
        return;
      }

      await self.clients.openWindow(target.href);
    })()
  );
});
