// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NorthCalibrationProvider } from '../../features/north-calibration/NorthCalibrationProvider'
import { DebugPage } from './DebugPage'

vi.mock('../../features/moon/astronomy', () => ({ getMoonPosition: () => ({ azimuth: 90, altitude: 20, isAboveHorizon: true }) }))
let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-18T10:00:00Z'))
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('DeviceOrientationEvent', {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  container = document.createElement('div')
  root = createRoot(container)
  await act(async () => root.render(<NorthCalibrationProvider><DebugPage state={{ status: 'success',
    location: { latitude: 35.68, longitude: 139.76, accuracy: 10, timestamp: Date.now() } }} requestLocation={vi.fn()} /></NorthCalibrationProvider>))
  await click('センサーを有効にする')
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function click(text: string) {
  const button = [...container.querySelectorAll('button')].find(button => button.textContent?.trim() === text)!
  expect(button.disabled).toBe(false)
  await act(async () => button.click())
}
async function sensor(accuracy: number, heading = 90, absolute = true) {
  await act(async () => {
    vi.advanceTimersByTime(100)
    window.dispatchEvent(Object.assign(new Event('deviceorientation'), {
      alpha: 315, beta: 90, gamma: 0, absolute, webkitCompassHeading: heading, webkitCompassAccuracy: accuracy,
    }))
  })
}
function compassPanel() { return container.querySelector('[aria-labelledby="compass-stability-title"]')! }
function output() {
  const main = container.querySelector('main')!
  return ['correctedRotation', 'moonInDevice', 'correctedHeading', 'angleToMoon'].map(key => main.dataset[key])
}

it('quality changes and snapshots observe accepted events without gating calibration or changing AR outputs', async () => {
  for (let i = 0; i < 24; i++) await sensor(6)
  expect(compassPanel().textContent).toContain('GOOD')
  await click('北基準を合わせる')
  const before = output()
  await click('現在の診断を記録')
  const first = container.querySelector('article')!.textContent
  expect(first).toContain('GOOD')
  await sensor(25)
  expect(compassPanel().textContent).toContain('POOR')
  expect(output()).toEqual(before)
  await click('現在の診断を記録')
  expect(container.querySelectorAll('article')).toHaveLength(2)
  expect(container.querySelector('article')!.textContent).toContain('POOR')
  expect(container.querySelectorAll('article')[1].textContent).toBe(first)
  // Quality is never a new refusal condition: calibration remains available under POOR.
  await click('北基準を合わせる')
  expect(output()).toEqual(before)
  // Once absolute events are accepted, ignored relative events must not contaminate the history/current accuracy.
  await sensor(100, 180, false)
  expect(compassPanel().textContent).toContain('webkitCompassAccuracy (°)25.00')
  expect(output()).toEqual(before)
})

it('one accepted sample is not multiplied by time-mode changes, UI renders or snapshot clicks', async () => {
  await sensor(6)
  const select = container.querySelector('select')!
  await act(async () => { select.value = 'current'; select.dispatchEvent(new Event('change', { bubbles: true })) })
  await click('現在の診断を記録')
  const counts = [...compassPanel().querySelectorAll('dt')].filter(dt => dt.textContent === 'sample count')
  expect(counts.map(dt => dt.nextElementSibling!.textContent)).toEqual(['1', '1'])
  expect(compassPanel().textContent).toContain('UNAVAILABLE')
})
