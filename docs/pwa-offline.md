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

## Remaining steps

1. Add the Service Worker that consumes this inventory and register it from the application.
2. Add navigation fallback so offline visits to `/ar` and `/calibration` can load the cached app shell.
3. Add the update notification and user-triggered activation flow without interrupting an AR session.
4. Verify installation, offline relaunch, location/sensor access, recalibration and upgrades on an iPhone.

At step 1 the inventory is generated but nothing is cached on the user's device. The browser does not read it yet. Offline launch is not enabled until the subsequent Service Worker steps are implemented.
