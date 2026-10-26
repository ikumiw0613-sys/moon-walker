// Build placeholders are replaced by scripts/generate-precache-manifest.mjs.
const PRECACHE = /* __MOON_WALKER_PRECACHE__ */ null
const CACHE_PREFIX = 'moon-walker-static-v1-'
const CACHE_NAME = /* __MOON_WALKER_CACHE_NAME__ */ ''
const CACHED_PATHS = new Set(PRECACHE.files.map(file => new URL(file.url, self.location.origin).pathname))
const APP_ROUTES = new Set([
  '/', '/index.html', '/ar', '/ar/', '/calibration', '/calibration/',
  '/moon-info', '/moon-info/', '/debug', '/debug/',
])

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

async function cachedOrNetwork(request, cacheUrl) {
  try {
    const cache = await caches.open(CACHE_NAME)
    const saved = await cache.match(cacheUrl)
    if (saved) return saved
  } catch {
    // Storage may have been cleared or become unavailable; online requests can still succeed.
  }
  return fetch(request)
}

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET' || request.headers.has('range')) return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    if (APP_ROUTES.has(url.pathname)) {
      // Return the app shell without redirecting: its router still sees the original path/query.
      event.respondWith(cachedOrNetwork(request, new URL('/index.html', self.location.origin).href))
    }
  } else if (CACHED_PATHS.has(url.pathname)) {
    // Cache only this build's static files. Query strings do not select another asset version.
    event.respondWith(cachedOrNetwork(request, url.origin + url.pathname))
  }
})

// Normal browser lifecycle: wait for existing clients to close before replacing their worker.
