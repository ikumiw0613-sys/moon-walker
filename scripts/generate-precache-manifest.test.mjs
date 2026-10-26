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
  const manifest = await writePrecacheManifest(directory)
  await writeServiceWorker(directory, manifest)
  const handlers = new Map()
  const addAll = vi.fn().mockResolvedValue(undefined)
  const cacheStorage = {
    open: vi.fn().mockResolvedValue({ addAll }),
    delete: vi.fn().mockResolvedValue(true),
    keys: vi.fn().mockResolvedValue([]),
  }
  runInNewContext(await readFile(join(directory, 'sw.js'), 'utf8'), {
    self: { location: { origin: 'https://moon.test' }, addEventListener: (type, handler) => handlers.set(type, handler) },
    caches: cacheStorage, Request, URL,
  })
  const dispatch = type => {
    let completion
    handlers.get(type)({ waitUntil: promise => { completion = promise } })
    return completion
  }
  return { manifest, handlers, addAll, cacheStorage, dispatch }
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
  expect(handlers.has('fetch')).toBe(false)
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
