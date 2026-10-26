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

Registration uses `updateViaCache: none`, and Vercel serves `/sw.js` with `Cache-Control: no-cache`. The worker follows the normal waiting lifecycle unless the user explicitly requests activation through the step 4 update flow. It does not claim open tabs.

Verify the worker using a production build (`npm run build`, then `npm run preview`) or HTTPS deployment; the Vite development server is intentionally excluded.

## Step 3: serve saved app files and route navigations

The worker handles same-origin GET requests for this build's cached static files. It reads its own version's cache first, keeping HTML and its hashed JS/CSS consistent. If the saved file is missing or storage cannot be read, it attempts the original network request. It does not write network fallback responses into the build cache.

For browser navigation, the following paths use cached `/index.html`: `/`, `/index.html`, `/ar`, `/calibration`, `/moon-info`, `/debug`, and trailing-slash versions of the named routes. The browser URL is not redirected or rewritten, so the app router and query parameters such as `?arDebug=projection` retain their original values. The `/debug` build-time feature gate still applies; having an offline app shell does not enable that feature.

Static asset cache keys use the origin and pathname, ignoring query strings. This only applies to URLs in the embedded build inventory. Unknown routes, `/api/*`, external origins, non-GET requests, range requests, `/sw.js` and `/precache-manifest.json` are left to the browser's normal network handling. Runtime data is not persisted.

Offline launch requires a prior online install that finished successfully and an active worker controlling the navigation. Initial activation does not take over the already open page; reopening or reloading allows the browser to use the active worker. Device location and orientation are acquired again after launch. Their availability without connectivity must be verified separately on an iPhone.

Suggested real-browser verification:

1. Build and serve the app, open it online, and wait for the worker installation and Cache Storage entries to complete.
2. Reload the page once and confirm that a Service Worker controls it.
3. Set the browser offline, then reload `/`, `/ar`, `/calibration` and `/moon-info`. Check the app shell, styles, moon image and calibration guide.
4. Open `/ar?arDebug=projection` offline and confirm that the query and diagnostic panel are preserved.
5. On an iPhone, install from Safari, open it online to finish setup, then reopen it from the home screen offline. Check location/sensor acquisition and recalibration separately.

Automated tests exercise the generated worker's fetch handler with an offline network stub, including cache misses, route/query preservation and requests that must not be intercepted. These tests do not substitute for iPhone installation and lifecycle verification.

## Step 4: offer completed updates and activate on user request

`serviceWorkerUpdates.ts` observes the registered worker. It offers an update when `registration.waiting` already exists or an installing worker reaches `installed`, provided the page already has a controlling worker. Initial installation and failed/incomplete asset downloads do not produce an update notice. Online and foreground events trigger another update check; failures keep the current saved app usable.

`PWAUpdateNotice` subscribes to that state through `useSyncExternalStore`, so a waiting update found before React mounts is still visible. The notice appears on home and moon-info pages. AR, calibration and debug retain the pending state without presenting the notice. It offers `更新する` and `後で`; deferring hides that worker's notice for the current page session. A newer completed worker or the next app launch can offer an update again. Deferral is not persistent storage.

The update button sends `ACTIVATE_UPDATE` to the waiting worker. Only this explicit message can request `skipWaiting`. The worker checks open same-origin window clients first. If another window/tab exists, it replies `UPDATE_BLOCKED` and keeps waiting, asking the user to close other moon-walker sessions before retrying. This prevents an opted-in update from deleting a cache still needed by another session. Activation failures reply `UPDATE_FAILED`.

The requesting page waits for its controlling worker to change before reloading once. Other controller changes never trigger an automatic reload. Duplicate update clicks are ignored while switching. If the worker already activated naturally, the explicit button can reload directly. A 12-second activation timeout displays a retryable error without reloading. Buttons are disabled during switching.

The notice explains that updating opens the screen again and requires location acquisition and orientation adjustment. An update does not preserve north correction or diagnostic snapshots across reloads. Their existing lifetime is unchanged.

Real-browser update verification requires two builds:

1. Install build A containing the update notice code, complete offline setup, and reload so its worker controls the page.
2. Serve changed build B on the same HTTPS origin (or local preview origin).
3. Reopen/foreground the app online and wait for build B's file downloads to finish. The notice must appear on home/moon-info without an automatic reload. On AR/calibration it remains pending until navigating to a suitable page.
4. Choose `後で` and verify that the current session continues. Relaunch to see the waiting update again.
5. Choose `更新する`; after the worker switches, verify one reload and build B's content. Then verify an offline relaunch.
6. Repeat with two open moon-walker windows. Updating must request closing the other session instead of activating. Close it and retry.

Devices still running a version from before the notice code was introduced cannot display this new UI. Close/reopen those old sessions once to acquire build A before testing A-to-B notifications.

## Remaining verification

Verify installation, offline relaunch, location/sensor access, recalibration and upgrades on an iPhone. Automated lifecycle and UI tests do not replace actual Safari/Home Screen app testing.
