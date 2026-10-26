import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const PRECACHE_MANIFEST_FILENAME = 'precache-manifest.json'
const CACHEABLE_EXTENSIONS = new Set([
  '.html', '.js', '.css', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.otf', '.wasm', '.webmanifest',
])
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

/** Build output only: never reads sensor state, browser storage or source files. */
export async function createPrecacheManifest(outputDirectory) {
  const files = []
  async function visit(segments = []) {
    const entries = await readdir(resolve(outputDirectory, ...segments), { withFileTypes: true })
    for (const entry of entries) {
      const next = [...segments, entry.name]
      if (entry.isDirectory()) {
        await visit(next)
      } else if (entry.isFile() && CACHEABLE_EXTENSIONS.has(extname(entry.name).toLowerCase())
        // Service-worker scripts are checked by the browser, not served from this cache.
        && !(next.length === 1 && /^(sw|service-worker)\.js$/i.test(entry.name))) {
        const contents = await readFile(resolve(outputDirectory, ...next))
        files.push({ url: '/' + next.map(encodeURIComponent).join('/'), revision: digest(contents), size: contents.byteLength })
      }
    }
  }
  await visit()
  files.sort((a, b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0)
  for (const required of ['/index.html', '/manifest.webmanifest']) {
    if (!files.some(file => file.url === required)) throw new Error(`Required PWA build file missing: ${required}`)
  }
  // No timestamps: identical builds must have the same ID; any content change must change it.
  return { version: 1, buildId: digest(JSON.stringify(files)), files }
}

export async function writePrecacheManifest(outputDirectory) {
  const manifest = await createPrecacheManifest(outputDirectory)
  await writeFile(resolve(outputDirectory, PRECACHE_MANIFEST_FILENAME), JSON.stringify(manifest, null, 2) + '\n')
  return manifest
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const manifest = await writePrecacheManifest(resolve('dist'))
  const bytes = manifest.files.reduce((sum, file) => sum + file.size, 0)
  console.log(`PWA precache list: ${manifest.files.length} files, ${(bytes / 1024).toFixed(1)} KiB; build ${manifest.buildId.slice(0, 12)}`)
}
