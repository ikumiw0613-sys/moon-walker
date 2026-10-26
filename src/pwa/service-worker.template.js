// Build placeholders are replaced by scripts/generate-precache-manifest.mjs.
const PRECACHE = /* __MOON_WALKER_PRECACHE__ */ null
const CACHE_PREFIX = 'moon-walker-static-v1-'
const CACHE_NAME = /* __MOON_WALKER_CACHE_NAME__ */ ''

async function installAppFiles() {
  try {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(PRECACHE.files.map(file => new Request(new URL(file.url, self.location.origin), {
      cache: 'reload', credentials: 'same-origin', redirect: 'error', integrity: file.integrity,
    })))
  } catch (error) {
    await caches.delete(CACHE_NAME)
    throw error
  }
}

self.addEventListener('install', event => {
  event.waitUntil(installAppFiles())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)))
  })())
})

// Normal browser lifecycle: wait for existing clients to close before replacing their worker.
// Navigation fallback and cache-backed fetch handling are added in the next implementation step.
