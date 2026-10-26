import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { createPrecacheManifest, PRECACHE_MANIFEST_FILENAME, writePrecacheManifest } from './generate-precache-manifest.mjs'

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
