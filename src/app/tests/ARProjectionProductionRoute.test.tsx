// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../App'
import type { Navigate } from '../navigation/AppNavigation'
import { projectionDiagnosticDestination } from '../navigation/projectionDiagnosticNavigation'

vi.mock('../../features/geolocation/useGeolocation', () => ({
  useGeolocation: () => ({ state: { status: 'idle' }, requestLocation: vi.fn() }),
}))
vi.mock('../../pages/calibration/CalibrationPage', () => ({
  CalibrationPage: ({ navigate }: { navigate: Navigate }) => <button onClick={() => navigate('/ar')}>校正完了（遷移テスト）</button>,
}))

let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
beforeEach(() => {
  vi.stubEnv('DEV', false)
  vi.stubEnv('VITE_ENABLE_DEBUG', 'false')
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  window.history.replaceState(null, '', '/')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it.each(['/ar?arDebug=projection', '/ar/?arDebug=projection'])(
  'production direct URL %s shows the AR diagnosis without redirecting home or requiring VITE_ENABLE_DEBUG', async path => {
    window.history.replaceState(null, '', path)
    await act(async () => root.render(<App />))
    expect(container.querySelector('main.mw-ar')).not.toBeNull()
    expect(document.querySelector('.ar-projection-diagnostic')).not.toBeNull()
    expect(window.location.pathname).toBe(new URL(path, window.location.origin).pathname)
    expect(window.location.search).toBe('?arDebug=projection')
  },
)

it.each(['/ar', '/ar?arDebug=other', '/ar?arProjection=full-screen'])(
  'production normal AR %s does not activate diagnostics', async path => {
    window.history.replaceState(null, '', path)
    await act(async () => root.render(<App />))
    expect(container.querySelector('main.mw-ar')).not.toBeNull()
    expect(document.querySelector('.ar-projection-diagnostic')).toBeNull()
  },
)

it('keeps the explicit diagnosis query through calibration and returning to AR without changing calibration logic', async () => {
  window.history.replaceState(null, '', '/ar?arDebug=projection')
  await act(async () => root.render(<App />))
  const prepare = container.querySelector<HTMLAnchorElement>('a[href="/calibration"]')!
  await act(async () => prepare.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
  expect(window.location.pathname).toBe('/calibration')
  expect(window.location.search).toBe('?arDebug=projection')
  expect(document.querySelector('.ar-projection-diagnostic')).toBeNull()
  await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
  expect(window.location.pathname).toBe('/ar')
  expect(window.location.search).toBe('?arDebug=projection')
  expect(document.querySelector('.ar-projection-diagnostic')).not.toBeNull()
})

it('only forwards known diagnostic parameters between AR and calibration', () => {
  expect(projectionDiagnosticDestination('/ar', '?arDebug=projection&arProjection=full-screen&extra=x', '/calibration'))
    .toBe('/calibration?arDebug=projection&arProjection=full-screen')
  expect(projectionDiagnosticDestination('/calibration', '?arDebug=projection', '/ar')).toBe('/ar?arDebug=projection')
  expect(projectionDiagnosticDestination('/ar', '?arDebug=projection', '/')).toBe('/')
  expect(projectionDiagnosticDestination('/ar', '?arDebug=projection', '/moon-info')).toBe('/moon-info')
  expect(projectionDiagnosticDestination('/', '?arDebug=projection', '/ar')).toBe('/ar')
  expect(projectionDiagnosticDestination('/ar', '?arDebug=other', '/calibration')).toBe('/calibration')
  expect(projectionDiagnosticDestination('/calibration', '', '/ar')).toBe('/ar')
})
