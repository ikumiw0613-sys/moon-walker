import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { JSDOM, VirtualConsole } from 'jsdom'

// Verify the actual Vite production entry, locally or as served by the production domain.
// This checks routing and the production query gate, not browser layout or physical sensors.
const baseUrl = process.argv[2]
const target = baseUrl ? new URL('/ar?arDebug=projection', baseUrl).href : 'https://local.test/ar?arDebug=projection'
async function getText(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  if (response.redirected) throw new Error(`Unexpected redirect: ${url} -> ${response.url}`)
  return response.text()
}
const html = baseUrl ? await getText(target) : await readFile('dist/index.html', 'utf8')
const entry = html.match(/<script\b[^>]*\bsrc="([^"]+)"/i)?.[1]
if (!entry) throw new Error('Production module entry missing')
const source = baseUrl ? await getText(new URL(entry, target)) : await readFile(resolve('dist', '.' + entry), 'utf8')

for (const [path, enabled] of [['/ar?arDebug=projection', true], ['/ar', false], ['/ar?arDebug=other', false]]) {
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('jsdomError', error => { throw error })
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: new URL(path, baseUrl ?? 'https://local.test').href,
    runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole,
    beforeParse(window) {
      window.HTMLCanvasElement.prototype.getContext = () => null
      window.scrollTo = () => {}
      window.isSecureContext = true
      window.DeviceOrientationEvent = class extends window.Event {}
    },
  })
  try {
    dom.window.eval(source)
    for (let attempt = 0; attempt < 100; attempt++) {
      if (dom.window.document.querySelector('main.mw-ar') && (!enabled || dom.window.document.querySelector('.ar-projection-diagnostic'))) break
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    if (!dom.window.document.querySelector('main.mw-ar')) throw new Error(`${path}: AR page missing`)
    if (!!dom.window.document.querySelector('.ar-projection-diagnostic') !== enabled) throw new Error(`${path}: incorrect diagnosis query gate`)
    if (dom.window.location.pathname !== '/ar') throw new Error(`${path}: redirected to ${dom.window.location.pathname}`)
    console.log(`PASS ${path}: AR rendered; diagnostics=${enabled}; no home redirect`)
    if (enabled) {
      const prepare = dom.window.document.querySelector('.mw-ar-state a[href="/calibration"]')
      if (!prepare) throw new Error('Direct entry calibration link missing')
      prepare.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
      await new Promise(resolve => setTimeout(resolve, 50))
      if (dom.window.location.pathname !== '/calibration' || dom.window.location.search !== '?arDebug=projection') throw new Error('Calibration navigation lost diagnosis query')
      // Simulate ordinary accepted orientation events; the existing hold and completion timers run unchanged.
      for (let sample = 0; sample < 10; sample++) {
        await new Promise(resolve => setTimeout(resolve, 100))
        dom.window.dispatchEvent(Object.assign(new dom.window.Event('deviceorientation'), {
          alpha: 0, beta: 90, gamma: 0, absolute: true, webkitCompassHeading: 0, webkitCompassAccuracy: 6,
        }))
      }
      await new Promise(resolve => setTimeout(resolve, 700))
      if (dom.window.location.pathname !== '/ar' || dom.window.location.search !== '?arDebug=projection'
        || !dom.window.document.querySelector('.ar-projection-diagnostic')) throw new Error('Calibration return lost diagnosis mode')
      console.log('PASS direct entry -> calibration -> AR: production diagnosis query retained')
    }
  } finally { dom.window.close() }
}
console.log(`Verified production entry: ${entry}`)
