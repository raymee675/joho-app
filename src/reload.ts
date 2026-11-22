/** Fetch the current app shell, clear only this app's Workbox caches, then reload. */
export async function reloadApp(): Promise<void> {
  const appScope = new URL(import.meta.env.BASE_URL, location.href).href;
  const freshIndex = new URL('index.html', appScope);
  freshIndex.searchParams.set('_refresh', `${Date.now()}-${crypto.randomUUID()}`);

  // Check that the latest app shell can actually be reached before touching caches.
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(freshIndex, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    });
    if (!response.ok || !response.headers.get('content-type')?.toLowerCase().startsWith('text/html')) {
      throw new Error('unavailable');
    }
  } catch {
    throw new Error('最新情報を取得できませんでした。インターネットに接続して、もう一度お試しください。');
  } finally {
    window.clearTimeout(timeout);
  }

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const appRegistrations = registrations.filter((registration) => registration.scope === appScope);
    await Promise.all(appRegistrations.map((registration) => registration.unregister()));

    if ('caches' in window) {
      const suffix = `-${appScope}`;
      const appCaches = (await caches.keys()).filter((name) => name.startsWith('workbox-') && name.endsWith(suffix));
      await Promise.all(appCaches.map((name) => caches.delete(name)));
    }
  }

  const destination = new URL(location.href);
  destination.searchParams.set('_refresh', `${Date.now()}-${crypto.randomUUID()}`);
  location.replace(destination.href);
}
