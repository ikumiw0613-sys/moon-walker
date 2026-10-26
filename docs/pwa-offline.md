# PWA offline implementation

## Step 1: generate the static cache inventory

`npm run build` executes `scripts/generate-precache-manifest.mjs` after TypeScript and Vite finish. It reads the actual output in `dist/` and writes `dist/precache-manifest.json`. No new dependency is required.

Each entry contains:

- `url`: a root-relative browser URL, with forward slashes and URL-encoded file names.
- `revision`: SHA-256 of the file contents, to distinguish changed assets even when their names stay the same.
- `size`: file size in bytes.

The inventory also has a schema `version` and a deterministic `buildId` derived from the sorted entries. Rebuilding identical contents produces the same ID; changing an icon, HTML or bundle changes the ID. The app is hosted at the origin root, matching the web manifest's `scope` and `start_url`.

Included: generated HTML, JS, CSS, images (including moon-image and calibration-guide), icons, fonts, WASM and the web app manifest. The inventory reads build files only. Browser location, orientation, north correction and diagnostic snapshots are never read or persisted.

Excluded: source maps, arbitrary JSON/data files, the inventory itself and root-level `sw.js` / `service-worker.js`. Symbolic links are not traversed. Missing `index.html` or `manifest.webmanifest` makes generation fail rather than publishing an incomplete list.

`dist/` is generated and remains excluded from Git. Edit the source assets or generator, then rebuild; do not edit the generated inventory manually. Inspect it with:

```powershell
Get-Content dist/precache-manifest.json
```

## Step 2: register and install the Service Worker

The production entry (`src/main.tsx`) calls `registerServiceWorker` once, outside React rendering. It waits for the page's `load` event before registering `/sw.js` at scope `/`. Unsupported browsers and insecure contexts skip registration. Registration errors are logged and contained so they do not reject application startup. The next launch attempts registration again. Vite's development server does not register a worker.

After generating the inventory, the build also renders `src/pwa/service-worker.template.js` into `dist/sw.js`. The inventory's URLs and SHA-256 integrity values are embedded in the worker. This binds the downloaded files to the worker's own build and avoids fetching a separate inventory that might belong to a newer deployment. Asset changes alter the worker bytes, allowing the browser's normal update check to discover new builds. The cache name hashes both the inventory build ID and worker template, so template changes also use a distinct cache.

During `install`, `cache.addAll` downloads the entire inventory with HTTP cache bypassed and integrity checks enabled. The install event waits for this to finish. A failed download or integrity check rejects installation and deletes only that build's incomplete cache. Existing caches remain available. `activate` removes older caches with this app's cache prefix and preserves unrelated caches.

Registration uses `updateViaCache: none`, and Vercel serves `/sw.js` with `Cache-Control: no-cache`. The worker follows the normal waiting lifecycle: it does not force activation, claim open tabs, or reload a running app. The user-facing update flow comes later.

At step 2 files are downloaded and stored on the device, but fetch handling has not been added yet. The worker does not serve cached responses or provide offline navigation at this stage. Verify this step using a production build (`npm run build`, then `npm run preview`) or HTTPS deployment; the Vite development server is intentionally excluded.

## Remaining steps

1. Add cache-backed fetch handling and navigation fallback so offline visits to `/`, `/ar` and `/calibration` can load the cached app shell.
2. Add the update notification and user-triggered activation flow without interrupting an AR session.
3. Verify installation, offline relaunch, location/sensor access, recalibration and upgrades on an iPhone.
