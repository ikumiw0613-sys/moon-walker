// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { DebugPage } from './DebugPage'
import { NorthCalibrationProvider } from '../../features/north-calibration/NorthCalibrationProvider'
import { YOMIURILAND_REFERENCE } from '../../features/debug/landmarks'

const sensor = vi.hoisted(() => ({ receivedAt: 0, heading: 7.5 }))
vi.mock('../../features/device-orientation/useDeviceOrientation', () => ({
  useDeviceOrientation: () => {
    const event = { alpha: 0, beta: 90, gamma: 0, absolute: false,
      eventType: 'deviceorientation', receivedAt: sensor.receivedAt,
      webkitCompassHeading: sensor.heading, webkitCompassAccuracy: 10 }
    return { state: { ...event, status: 'active', compassHeading: sensor.heading, message: '' },
      diagnostics: { lastReceived: event, lastAccepted: event }, requestPermission: vi.fn() }
  },
}))
let root: ReturnType<typeof createRoot> | undefined
afterEach(async () => {
  if (root) await act(async () => root!.unmount())
  root = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('uses actual date despite fixed Moon date, needs no calibration, freezes snapshots and excludes stale/manual headings', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-08T01:23:45Z'))
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  sensor.receivedAt = Date.now()
  sensor.heading = 7.5
  const container = document.createElement('div')
  root = createRoot(container)
  const location = { latitude: YOMIURILAND_REFERENCE.latitude - 0.01,
    longitude: YOMIURILAND_REFERENCE.longitude, accuracy: 10, timestamp: Date.now() }
  await act(async () => root!.render(<NorthCalibrationProvider>
    <DebugPage state={{ status: 'success', location }} requestLocation={vi.fn()} />
  </NorthCalibrationProvider>))
  const panel = container.querySelector('[aria-labelledby="true-north-validation-title"]')!
  expect(panel.textContent).toContain('2026-11-08T01:23:00.000Z')
  expect(panel.textContent).toContain('MAGNETIC-NORTH-LIKE')
  const timeMode = container.querySelector('select')!
  await act(async () => {
    timeMode.value = 'fixed'
    timeMode.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(container.querySelector('main')!.dataset.observationTime).toContain('2026-10-')
  expect(panel.textContent).toContain('2026-11-08T01:23:00.000Z')
  expect(panel.querySelector('dt')!.textContent).toBe('Reference target')
  expect(container.querySelector('main')!.dataset.correctedRotation).toBe('null')
  const record = [...container.querySelectorAll('button')].find(button => button.textContent === '現在の診断を記録')!
  await act(async () => record.click())
  const saved = container.querySelector('article')!.textContent
  expect(saved).toContain('MAGNETIC-NORTH-LIKE')
  expect(saved).toContain('2026-11-08T01:23:45.000Z')
  await act(async () => vi.advanceTimersByTime(1500))
  expect(panel.textContent).toContain('INCONCLUSIVE')
  expect(panel.textContent).toContain('古い値は比較しません')
  const manual = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!
  await act(async () => manual.click())
  expect(panel.textContent).toContain('INCONCLUSIVE')
  expect(container.querySelector('article')!.textContent).toBe(saved)
  expect(container.querySelector('main')!.dataset.correctedRotation).toBe('null')
})
