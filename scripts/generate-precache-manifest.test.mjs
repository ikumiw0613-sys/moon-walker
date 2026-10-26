import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { afterEach, expect, it, vi } from 'vitest'
import { createPrecacheManifest, PRECACHE_MANIFEST_FILENAME, writePrecacheManifest, writeServiceWorker } from './generate-precache-manifest.mjs'

const temporaryDirectories = []
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'moon-walker-precache-'))
  temporaryDirectories.push(directory)
  await writeFile(join(directory, 'index.html'), '<script src="/assets/app-abc123.js"></script>')
  await writeFile(join(directory, 'manifest.webmanifest'), '{"name":"moon-walker"}')
  return directory
}

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    // Only remove paths created above, inside the OS temporary directory.
    expect(dirname(directory)).toBe(resolve(tmpdir()))
    expect(basename(directory)).toMatch(/^moon-walker-precache-/)
    await rm(directory, { recursive: true, force: true })
  }
})

it('lists hashed bundles, images, icons and the web manifest with browser URLs and content hashes', async () => {
  const directory = await fixture()
  await mkdir(join(directory, 'assets'))
  await mkdir(join(directory, 'icons'))
  await writeFile(join(directory, 'assets/app-abc123.js'), 'console.log("moon")')
  await writeFile(join(directory, 'assets/app-def456.css'), 'body { color: white }')
  await writeFile(join(directory, 'icons/icon-192.png'), new Uint8Array([1, 2, 3]))
  await writeFile(join(directory, 'moon image.png'), new Uint8Array([4, 5]))
  const manifest = await createPrecacheManifest(directory)
  expect(manifest.files.map(file => file.url)).toEqual([
    '/assets/app-abc123.js', '/assets/app-def456.css', '/icons/icon-192.png',
    '/index.html', '/manifest.webmanifest', '/moon%20image.png',
  ])
  expect(manifest.files.find(file => file.url === '/icons/icon-192.png')).toMatchObject({
    revision: createHash('sha256').update(new Uint8Array([1, 2, 3])).digest('hex'), size: 3,
  })
})

it('excludes maps, arbitrary data, the generated list itself and worker registration scripts', async () => {
  const directory = await fixture()
  for (const file of ['app.js.map', '.env', 'diagnostics.json', PRECACHE_MANIFEST_FILENAME, 'sw.js', 'service-worker.js']) {
    await writeFile(join(directory, file), 'not part of the app shell')
  }
  expect((await createPrecacheManifest(directory)).files.map(file => file.url)).toEqual(['/index.html', '/manifest.webmanifest'])
})

it('writes a repeatable list and changes the build ID when existing asset contents change', async () => {
  const directory = await fixture()
  const first = await writePrecacheManifest(directory)
  const second = await writePrecacheManifest(directory)
  expect(second).toEqual(first)
  expect(JSON.parse(await readFile(join(directory, PRECACHE_MANIFEST_FILENAME), 'utf8'))).toEqual(first)
  await writeFile(join(directory, 'index.html'), '<h1>Updated app</h1>')
  const changed = await createPrecacheManifest(directory)
  expect(changed.buildId).not.toBe(first.buildId)
  expect(changed.files.find(file => file.url === '/index.html').revision)
    .not.toBe(first.files.find(file => file.url === '/index.html').revision)
  expect(changed.files.find(file => file.url === '/manifest.webmanifest').revision)
    .toBe(first.files.find(file => file.url === '/manifest.webmanifest').revision)
})

it('fails the build rather than producing an incomplete offline shell', async () => {
  const directory = await fixture()
  await rm(join(directory, 'index.html'))
  await expect(createPrecacheManifest(directory)).rejects.toThrow('Required PWA build file missing: /index.html')
})

it('embeds the exact build inventory and changes worker bytes when any asset changes', async () => {
  const directory = await fixture()
  const first = await writePrecacheManifest(directory)
  await writeServiceWorker(directory, first)
  const firstWorker = await readFile(join(directory, 'sw.js'), 'utf8')
  expect(firstWorker).toContain(first.buildId)
  expect(firstWorker).not.toContain('/* __MOON_WALKER_')
  await writeServiceWorker(directory, await createPrecacheManifest(directory))
  expect(await readFile(join(directory, 'sw.js'), 'utf8')).toBe(firstWorker)
  await writeFile(join(directory, 'index.html'), '<h1>New release</h1>')
  await writeServiceWorker(directory, await createPrecacheManifest(directory))
  expect(await readFile(join(directory, 'sw.js'), 'utf8')).not.toBe(firstWorker)
})

async function workerFixture() {
  const directory = await fixture()
  await mkdir(join(directory, 'assets'))
  await writeFile(join(directory, 'assets/app-abc123.js'), 'console.log("moon")')
  await writeFile(join(directory, 'moon-image.png'), new Uint8Array([1, 2, 3]))
  const manifest = await writePrecacheManifest(directory)
  await writeServiceWorker(directory, manifest)
  const handlers = new Map()
  const addAll = vi.fn().mockResolvedValue(undefined)
  const match = vi.fn().mockResolvedValue(undefined)
  const networkFetch = vi.fn().mockRejectedValue(new TypeError('Offline'))
  const cacheStorage = {
    open: vi.fn().mockResolvedValue({ addAll, match }),
    delete: vi.fn().mockResolvedValue(true),
    keys: vi.fn().mockResolvedValue([]),
  }
  runInNewContext(await readFile(join(directory, 'sw.js'), 'utf8'), {
    self: { location: { origin: 'https://moon.test' }, addEventListener: (type, handler) => handlers.set(type, handler) },
    caches: cacheStorage, Request, URL, fetch: networkFetch,
  })
  const dispatch = type => {
    let completion
    handlers.get(type)({ waitUntil: promise => { completion = promise } })
    return completion
  }
  const fetchRequest = (path, mode = 'navigate', options = {}) => {
    const request = { url: new URL(path, 'https://moon.test').href, method: 'GET', mode, headers: new Headers(), ...options }
    let completion
    handlers.get('fetch')({ request, respondWith: promise => { completion = promise } })
    return { request, completion }
  }
  return { manifest, handlers, addAll, match, networkFetch, cacheStorage, dispatch, fetchRequest }
}

it('waits for every app asset to be cached, using the build hashes as integrity checks', async () => {
  const { manifest, addAll, cacheStorage, dispatch, handlers } = await workerFixture()
  await dispatch('install')
  expect(cacheStorage.open).toHaveBeenCalledOnce()
  const requests = [...addAll.mock.calls[0][0]]
  expect(requests.map(request => request.url)).toEqual(manifest.files.map(file => 'https://moon.test' + file.url))
  expect(requests.map(request => request.integrity)).toEqual(manifest.files.map(file =>
    'sha256-' + Buffer.from(file.revision, 'hex').toString('base64')))
  expect(requests.every(request => request.cache === 'reload' && request.redirect === 'error')).toBe(true)
  expect(cacheStorage.delete).not.toHaveBeenCalled()
  expect(handlers.has('fetch')).toBe(true)
})

it('rejects incomplete installation and removes only the failed build cache', async () => {
  const { addAll, cacheStorage, dispatch } = await workerFixture()
  addAll.mockRejectedValue(new Error('Asset download or integrity check failed'))
  await expect(dispatch('install')).rejects.toThrow('Asset download or integrity check failed')
  expect(cacheStorage.delete).toHaveBeenCalledExactlyOnceWith(cacheStorage.open.mock.calls[0][0])
})

it('cleans older app caches only at activation and preserves the current and unrelated caches', async () => {
  const { cacheStorage, dispatch } = await workerFixture()
  await dispatch('install')
  const currentCache = cacheStorage.open.mock.calls[0][0]
  const oldCache = 'moon-walker-static-v1-old-build'
  cacheStorage.keys.mockResolvedValue([currentCache, oldCache, 'another-app-cache'])
  await dispatch('activate')
  expect(cacheStorage.delete).toHaveBeenCalledExactlyOnceWith(oldCache)
})

it.each(['/', '/index.html', '/ar', '/ar/', '/calibration', '/calibration/', '/moon-info', '/moon-info/', '/debug', '/debug/',
  '/ar?arDebug=projection&arProjection=full-screen'])('opens the saved app shell offline at %s without redirecting', async path => {
  const { match, networkFetch, fetchRequest } = await workerFixture()
  const saved = new Response('<html>Offline app</html>', { headers: { 'Content-Type': 'text/html' } })
  match.mockResolvedValue(saved)
  const { request, completion } = fetchRequest(path)
  await expect(completion).resolves.toBe(saved)
  expect(request.url).toBe('https://moon.test' + path)
  expect(match).toHaveBeenCalledExactlyOnceWith('https://moon.test/index.html')
  expect(networkFetch).not.toHaveBeenCalled()
})

it.each(['/assets/app-abc123.js', '/moon-image.png', '/moon-image.png?v=1', '/manifest.webmanifest'])(
  'serves this build\'s static file %s offline from its own cache', async path => {
    const { match, networkFetch, fetchRequest } = await workerFixture()
    const saved = new Response('Saved asset')
    match.mockResolvedValue(saved)
    await expect(fetchRequest(path, 'cors').completion).resolves.toBe(saved)
    expect(match).toHaveBeenCalledExactlyOnceWith('https://moon.test' + path.split('?')[0])
    expect(networkFetch).not.toHaveBeenCalled()
  },
)

it('uses the original network request when an app file has been evicted without caching a replacement', async () => {
  const { networkFetch, fetchRequest } = await workerFixture()
  const online = new Response('Online fallback')
  networkFetch.mockResolvedValue(online)
  const { request, completion } = fetchRequest('/ar?arDebug=projection')
  await expect(completion).resolves.toBe(online)
  expect(networkFetch).toHaveBeenCalledExactlyOnceWith(request)
})

it('falls back to the network if cache storage cannot be read', async () => {
  const { cacheStorage, networkFetch, fetchRequest } = await workerFixture()
  cacheStorage.open.mockRejectedValue(new Error('Storage unavailable'))
  const online = new Response('Online app')
  networkFetch.mockResolvedValue(online)
  await expect(fetchRequest('/').completion).resolves.toBe(online)
})

it('does not claim offline success if both the saved file and network are unavailable', async () => {
  const { fetchRequest } = await workerFixture()
  await expect(fetchRequest('/ar').completion).rejects.toThrow('Offline')
})

it.each([
  ['/api/location', 'cors', {}], ['/api/moon', 'navigate', {}], ['/unknown', 'navigate', {}],
  ['/assets/other-build.js', 'cors', {}], ['/sw.js', 'cors', {}], ['/precache-manifest.json', 'cors', {}],
  ['/ar', 'cors', {}], ['https://other.test/moon-image.png', 'cors', {}],
  ['/moon-image.png', 'cors', { method: 'POST' }],
  ['/moon-image.png', 'cors', { headers: new Headers({ Range: 'bytes=0-10' }) }],
])('leaves non-target request %s (%s) to the browser', async (path, mode, options) => {
  const { cacheStorage, fetchRequest, networkFetch } = await workerFixture()
  expect(fetchRequest(path, mode, options).completion).toBeUndefined()
  expect(cacheStorage.open).not.toHaveBeenCalled()
  expect(networkFetch).not.toHaveBeenCalled()
})
