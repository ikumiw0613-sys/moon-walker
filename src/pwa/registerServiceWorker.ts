/** Registration is started once by the production entry, outside React rendering. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!window.isSecureContext || !('serviceWorker' in navigator)) return null

  // Let the initial page and its assets finish loading before downloading the offline copy.
  if (document.readyState !== 'complete') {
    await new Promise<void>(resolve => {
      window.addEventListener('load', () => resolve(), { once: true })
    })
  }

  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
  } catch (error) {
    // Offline setup can fail while the already loaded app remains usable.
    console.warn('[PWA] Service Worker registration failed; it will be retried on the next launch.', error)
    return null
  }
}
