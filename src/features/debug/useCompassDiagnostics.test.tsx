// @vitest-environment jsdom
import { StrictMode, act, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { RawOrientationEvent } from '../device-orientation/useDeviceOrientation'
import { COMPASS_STALE_MS } from './compassDiagnostics'
import { useCompassDiagnostics } from './useCompassDiagnostics'

let result: ReturnType<typeof useCompassDiagnostics>
let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
let sequence: number
function Harness({ event, manual = false, active = true }: { event: RawOrientationEvent | null; manual?: boolean; active?: boolean }) {
  const current = useCompassDiagnostics(event, active, manual)
  useLayoutEffect(() => { result = current }, [current])
  return null
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(10000)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  sequence = 0
  container = document.createElement('div')
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
const event = (values: Partial<RawOrientationEvent> = {}): RawOrientationEvent => ({ sequence: ++sequence,
  alpha: 0, beta: 90, gamma: 0, absolute: false, receivedAt: Date.now(), eventType: 'deviceorientation',
  webkitCompassHeading: 90, webkitCompassAccuracy: 6, ...values })
async function show(value: RawOrientationEvent | null, manual = false, active = true) {
  await act(async () => root.render(<StrictMode><Harness event={value} manual={manual} active={active} /></StrictMode>))
}
async function collect() {
  for (let i = 0; i < 15; i++) {
    await act(async () => vi.advanceTimersByTime(100))
    await show(event())
  }
}

it('collects actual accepted samples without counting repeated renders or StrictMode twice', async () => {
  const first = event()
  await show(first)
  await show({ ...first })
  expect(result.stats.heading?.count).toBe(1)
  await collect()
  expect(result.quality.status).toBe('good')
  expect(result.stats.candidate?.median).toBe(270)
})
it('stopped updates expire even when the last accepted event is retained', async () => {
  await collect()
  await act(async () => vi.advanceTimersByTime(COMPASS_STALE_MS + 500))
  expect(result.quality.status).toBe('unavailable')
  expect(result.stats.heading).toBeNull()
})
it('negative/missing accuracy, missing compass and vertical poses cannot become GOOD using old samples', async () => {
  await collect()
  for (const values of [{ webkitCompassAccuracy: -1 }, { webkitCompassAccuracy: undefined },
    { webkitCompassHeading: undefined }, { beta: 0 }, { alpha: NaN }]) {
    await show(event(values))
    expect(result.quality.status).toBe('unavailable')
  }
})
it('manual and inactive modes clear history, and returning requires fresh samples', async () => {
  await collect()
  const value = event()
  await show(value, true)
  expect(result.current).toBeNull()
  expect(result.stats.heading).toBeNull()
  await show(value)
  expect(result.stats.heading?.count).toBe(1)
  expect(result.quality.status).toBe('unavailable')
  await show(value, false, false)
  expect(result.stats.heading).toBeNull()
})
it('visibility changes clear measurements and unmount cleans up the timer', async () => {
  await collect()
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  expect(result.stats.heading).toBeNull()
  expect(result.quality.status).toBe('unavailable')
  await act(async () => root.render(null))
  expect(vi.getTimerCount()).toBe(0)
})
