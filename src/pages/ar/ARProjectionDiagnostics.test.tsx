// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ARPage } from './ARPage'
import { getMoonPosition } from '../../features/moon/astronomy'
import { measureARProjection, changesFixedContainingBlock } from '../../features/debug/useARProjectionMeasurements'

vi.mock('../../features/north-calibration/useNorthCalibration', () => ({ useNorthCalibration: () => ({ calibrated: true, northCorrection: 0 }) }))
vi.mock('../../features/device-orientation/useDeviceOrientation', () => ({ useDeviceOrientation: () => ({
  state: { alpha: 0, beta: 90, gamma: 0, compassHeading: 0, status: 'active', message: '' },
  requestPermission: vi.fn(), diagnostics: { lastAccepted: { sequence: 1 } },
}) }))
vi.mock('../../features/moon/astronomy', () => ({ getMoonPosition: vi.fn(() => ({ azimuth: 15, altitude: 5, isAboveHorizon: true })) }))
let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
let originalUrl: string
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('innerWidth', 390)
  vi.stubGlobal('innerHeight', 844)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  originalUrl = window.location.href
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    if (this.classList.contains('mw-ar-viewport')) return new DOMRect(20, 100, 350, 500)
    if (this.classList.contains('moon-sprite')) {
      const fixed = this.style.position === 'fixed'
      const x = parseFloat(this.style.left) * (fixed ? 1 : 3.5) + (fixed ? 0 : 20)
      const y = parseFloat(this.style.top) * (fixed ? 1 : 5) + (fixed ? 0 : 100)
      return new DOMRect(x - 23, y - 23, 46, 46)
    }
    return new DOMRect()
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  window.history.replaceState(null, '', originalUrl)
  document.body.style.transform = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
async function show(query: string) {
  window.history.replaceState(null, '', '/ar' + query)
  await act(async () => root.render(<ARPage navigate={vi.fn()} state={{ status: 'success',
    location: { latitude: 35, longitude: 139, accuracy: 10, timestamp: 0 } }} requestLocation={vi.fn()} />))
  await act(async () => vi.advanceTimersByTime(250))
}
function data() {
  return JSON.parse(document.querySelector<HTMLElement>('[data-ar-projection-diagnostics]')!.dataset.arProjectionDiagnostics!)
}
async function choose(label: string, value: string) {
  if (document.querySelector<HTMLElement>('#ar-projection-panel')!.hidden) {
    await act(async () => document.querySelector<HTMLButtonElement>('.ar-projection-toggle')!.click())
  }
  const select = [...document.querySelectorAll<HTMLLabelElement>('.ar-projection-diagnostic label')]
    .find(element => element.textContent!.startsWith(label))!.querySelector('select')!
  await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })) })
}

it('starts minimized, keeps the close button outside the scroll area, and preserves settings when minimized', async () => {
  vi.mocked(getMoonPosition).mockReturnValueOnce({ azimuth: 15, altitude: 1, isAboveHorizon: true })
  await show('?arDebug=projection')
  const panel = document.querySelector<HTMLElement>('#ar-projection-panel')!
  const toggle = document.querySelector<HTMLButtonElement>('.ar-projection-toggle')!
  expect(panel.hidden).toBe(true)
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(toggle.textContent).toBe('投影診断を開く')
  expect(panel.contains(toggle)).toBe(false)
  const direction = document.querySelector<HTMLElement>('[aria-label="Direction error"]')!
  expect(direction).not.toBeNull()
  expect(panel.contains(direction)).toBe(false)
  expect(direction.closest('[hidden]')).toBeNull()
  expect(direction.textContent).toContain('Main error axis: HEADING')
  expect(data().directionError).toMatchObject({ moonAzimuth: 15, moonAltitude: 1, mainErrorAxis: 'HEADING' })
  expect(container.querySelector('.mw-ar-recalibrate')).not.toBeNull()
  await choose('月本体の配置基準', 'full-screen')
  expect(panel.hidden).toBe(false)
  expect(toggle.textContent).toBe('診断を閉じる')
  await act(async () => toggle.click())
  expect(panel.hidden).toBe(true)
  expect(data().placement).toBe('full-screen')
  expect(direction.closest('[hidden]')).toBeNull()
  await act(async () => vi.advanceTimersByTime(250))
  expect(panel.hidden).toBe(true)
  await act(async () => toggle.click())
  expect(panel.hidden).toBe(false)
  expect(data().placement).toBe('full-screen')
  await act(async () => panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(panel.hidden).toBe(true)
  expect(document.activeElement).toBe(toggle)
})

it('normal AR retains the exact percentage-based placement and has no diagnostic observers or panel', async () => {
  const interval = vi.spyOn(window, 'setInterval')
  await show('?arProjection=full-screen')
  expect(document.querySelector('.ar-projection-diagnostic')).toBeNull()
  const sprite = container.querySelector<HTMLElement>('.moon-sprite')!
  expect(sprite.style.left).toContain('%')
  expect(sprite.style.position).toBe('')
  expect(sprite.parentElement!.className).toBe('mw-ar-viewport')
  expect(interval.mock.calls.some(call => call[1] === 250)).toBe(false)
})

it('measures actual rects, compares both projections and switches placement without recalculating astronomy or pose', async () => {
  await show('?arDebug=projection')
  const initial = data()
  expect(initial.measurement.window).toEqual({ width: 390, height: 844 })
  expect(initial.measurement.viewport).toEqual({ left: 20, top: 100, width: 350, height: 500 })
  expect(initial.measurement.sprite.width).toBe(46)
  expect(initial.actualDelta.x).toBeCloseTo(0)
  expect(initial.actualDelta.y).toBeCloseTo(0)
  expect(initial.comparison.twoD).not.toBeNull()
  expect(initial.consistency.warning).toBe(true)
  const attributes = { ...container.querySelector('main')!.dataset }
  const astronomyCalls = vi.mocked(getMoonPosition).mock.calls.length
  await choose('月本体の配置基準', 'full-screen')
  const full = data()
  const sprite = document.body.querySelector<HTMLElement>(':scope > .moon-sprite')!
  expect(sprite).not.toBeNull()
  expect(sprite.style.position).toBe('fixed')
  expect(parseFloat(sprite.style.left)).toBeCloseTo(initial.screen.x * 390)
  expect(parseFloat(sprite.style.top)).toBeCloseTo(initial.screen.y * 844)
  expect(full.actualDelta.x).toBeCloseTo(0)
  expect(full.actualDelta.y).toBeCloseTo(0)
  expect(full.screen).toEqual(initial.screen)
  expect(full.moonInDevice).toEqual(initial.moonInDevice)
  await choose('仮FOV', 'viewport-h')
  expect(data().trialFov.vertical).not.toBe(60)
  expect(data().screen).toEqual(initial.screen)
  expect({ ...container.querySelector('main')!.dataset }).toEqual(attributes)
  expect(vi.mocked(getMoonPosition).mock.calls.length).toBe(astronomyCalls)
  await choose('月本体の配置基準', 'viewport')
  expect(container.querySelector('.mw-ar-viewport > .moon-sprite')).not.toBeNull()
  expect(document.body.querySelector(':scope > .moon-sprite')).toBeNull()
  await act(async () => root.render(null))
  expect(document.querySelector('.ar-projection-diagnostic')).toBeNull()
  expect(document.querySelector('.ar-projection-point')).toBeNull()
  expect(vi.getTimerCount()).toBe(0)
})

it('the full-screen query works only in opt-in diagnostics and CSS inspection checks actual ancestors', async () => {
  await show('?arDebug=projection&arProjection=full-screen')
  expect(data().placement).toBe('full-screen')
  const viewport = container.querySelector<HTMLElement>('.mw-ar-viewport')!
  const sprite = document.querySelector<HTMLElement>('.moon-sprite')!
  container.style.transform = 'translateX(10px)'
  const measured = measureARProjection(viewport, sprite)
  expect(measured.ancestors.some(style => style.transform === 'translateX(10px)')).toBe(true)
  expect(measured.ancestors.some(changesFixedContainingBlock)).toBe(true)
  // The full-screen sprite is portaled to body, so this app ancestor cannot change its fixed containing block.
  expect(measured.fixedContainingBlocks).toEqual([])
  document.body.style.transform = 'translateY(10px)'
  expect(measureARProjection(viewport, sprite).fixedContainingBlocks).toContain('body')
  document.body.style.transform = ''
})

it('warns and records the resulting coordinate when a grid row collapses to zero height', async () => {
  await show('?arDebug=projection')
  const viewport = container.querySelector<HTMLElement>('.mw-ar-viewport')!
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 100, 350, 0))
  await act(async () => vi.advanceTimersByTime(250))
  expect(data().measurement.viewport.height).toBe(0)
  expect(data().windowPosition.windowY).toBe(100)
  expect(document.querySelector('.ar-projection-diagnostic')!.textContent).toContain('viewportの幅または高さが0')
})
