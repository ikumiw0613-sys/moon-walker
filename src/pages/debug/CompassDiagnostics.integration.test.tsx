// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NorthCalibrationProvider } from '../../features/north-calibration/NorthCalibrationProvider'
import { DebugPage } from './DebugPage'
import { TOKYO_SKYTREE } from '../../features/debug/landmarks'
import { calculateBearing } from '../../shared/geo/geographicBearing'

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
function landmarkPanel() { return container.querySelector('[aria-labelledby="skytree-title"]')! }
function landmarkField(label: string) {
  return [...landmarkPanel().querySelectorAll('dt')].find(dt => dt.textContent === label)!.nextElementSibling!.textContent
}
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

it('shows a stable but wrong compass and freezes landmark errors in location comparison records', async () => {
  const bearing = calculateBearing(35.68, 139.76, TOKYO_SKYTREE.latitude, TOKYO_SKYTREE.longitude)!
  for (let i = 0; i < 12; i++) await sensor(6, bearing + 11)
  expect(compassPanel().textContent).toContain('Compass Quality: GOOD')
  expect(landmarkPanel().textContent).toContain('Landmark Accuracy BAD')
  expect(landmarkField('Compass error / actual error')).toBe('+11.0°')
  expect(landmarkField('Corrected heading')).toBe('unavailable')
  expect(container.querySelectorAll('#skytree-title')).toHaveLength(1)
  await click('北基準を合わせる')
  const calibrated = output()
  expect(landmarkField('Corrected heading error')).toBe('+11.0°')
  await click('現在の診断を記録')
  const first = container.querySelector('article')!.textContent
  expect(first).toContain('Landmark Accuracy: BAD')
  expect(first).toContain('+11.0°')
  await sensor(6, bearing + 1)
  expect(landmarkField('Compass error / actual error')).toBe('+1.0°')
  expect(landmarkPanel().textContent).toContain('Landmark Accuracy GOOD')
  expect(output()).toEqual(calibrated)
  await click('現在の診断を記録')
  expect(container.querySelector('article')!.textContent).toContain('Landmark Accuracy: GOOD')
  expect(container.querySelectorAll('article')[1].textContent).toBe(first)
})

it('does not substitute computed headings, manual input, stale data or ignored events for real Safari headings', async () => {
  await sensor(10, 50)
  const initial = landmarkField('Compass error / actual error')
  await sensor(1, 200, false)
  expect(landmarkField('Compass error / actual error')).toBe(initial)
  expect(landmarkField('webkitCompassAccuracy')).toBe('10.0°')
  await act(async () => vi.advanceTimersByTime(1500))
  expect(landmarkField('Compass error / actual error')).toBe('unavailable')
  await sensor(10, 50)
  const manual = [...container.querySelectorAll('label')].find(label => label.textContent?.includes('PCで向きを手動テストする'))!.querySelector('input')!
  await act(async () => manual.click())
  expect(landmarkField('webkitCompassHeading')).toBe('unavailable')
  expect(landmarkField('Corrected heading error')).toBe('unavailable')
})

it('does not use an absolute alpha-derived heading when webkitCompassHeading is absent', async () => {
  await act(async () => {
    vi.advanceTimersByTime(100)
    window.dispatchEvent(Object.assign(new Event('deviceorientation'), {
      alpha: 315, beta: 90, gamma: 0, absolute: true,
    }))
  })
  expect(landmarkField('Reference bearing')).not.toBe('unavailable')
  expect(landmarkField('webkitCompassHeading')).toBe('unavailable')
  expect(landmarkField('Compass error / actual error')).toBe('unavailable')
})
