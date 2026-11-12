// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalibrationPage } from './CalibrationPage'
import { ObservationTimeProvider } from '../../shared/time/ObservationTimeProvider'
import type { RawOrientationEvent } from '../../features/device-orientation/useDeviceOrientation'

const mocks = vi.hoisted(() => ({
  state: { status: 'active', alpha: 315 as number | null, beta: 90 as number | null,
    gamma: 0 as number | null, compassHeading: 90 as number | null, message: '' },
  event: null as RawOrientationEvent | null,
  save: vi.fn(), request: vi.fn(), retry: vi.fn(),
}))
vi.mock('../../features/device-orientation/useDeviceOrientation', () => ({ useDeviceOrientation: () => ({
  state: mocks.state, requestPermission: mocks.request, retryConnection: mocks.retry,
  diagnostics: { lastAccepted: mocks.event, lastReceived: mocks.event },
}) }))
vi.mock('../../features/north-calibration/useNorthCalibration', () => ({ useNorthCalibration: () => ({ saveNorthCalibration: mocks.save }) }))

let root: Root
let container: HTMLDivElement
let screenOrientation: EventTarget & { angle: number }
let sequence: number
const navigate = vi.fn()
async function show() {
  await act(async () => root.render(<ObservationTimeProvider><CalibrationPage navigate={navigate} /></ObservationTimeProvider>))
}
async function advance(ms: number) {
  await act(async () => vi.advanceTimersByTime(ms))
}
async function sample(ms = 100, patch: Partial<RawOrientationEvent> = {}, statePatch: Partial<typeof mocks.state> = {}) {
  await advance(ms)
  mocks.event = { ...mocks.event!, receivedAt: Date.now(), sequence: ++sequence, ...patch }
  mocks.state = { ...mocks.state, alpha: mocks.event.alpha, beta: mocks.event.beta, gamma: mocks.event.gamma,
    compassHeading: mocks.event.webkitCompassHeading ?? null, ...statePatch }
  await show()
}
async function samples(count: number, patch: Partial<RawOrientationEvent> = {}) {
  for (let i = 0; i < count; i++) await sample(100, patch)
}
async function finish() {
  const count = mocks.save.mock.calls.length
  for (let i = 0; i < 40 && mocks.save.mock.calls.length === count; i++) await sample()
  expect(mocks.save).toHaveBeenCalledTimes(count + 1)
}
beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-08T00:00:00Z'))
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  sequence = 0
  screenOrientation = Object.assign(new EventTarget(), { angle: 0 })
  vi.stubGlobal('screen', { orientation: screenOrientation })
  mocks.state = { status: 'active', alpha: 315, beta: 90, gamma: 0, compassHeading: 90, message: '' }
  mocks.event = { alpha: 315, beta: 90, gamma: 0, absolute: false, eventType: 'deviceorientation',
    sequence, receivedAt: Date.now(), webkitCompassHeading: 90, webkitCompassAccuracy: 5 }
  mocks.save.mockClear()
  mocks.request.mockClear()
  mocks.retry.mockClear()
  navigate.mockClear()
  container = document.createElement('div')
  root = createRoot(container)
  await show()
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('automatic multi-sample calibration', () => {
  it('keeps permission and reconnection controls for unavailable, waiting, denied and error states', async () => {
    for (const api of [{}, { requestPermission: vi.fn() }]) {
      vi.stubGlobal('DeviceOrientationEvent', api)
      await sample(100, {}, { status: 'unavailable' })
      const button = container.querySelector('button')!
      expect(button.textContent).toBe('向きセンサーに再接続する')
      await act(async () => button.click())
      await sample(100, {}, { status: 'waiting' })
      expect(container.querySelector('button')).toBeNull()
    }
    expect(mocks.retry).toHaveBeenCalledTimes(2)
    for (const status of ['denied', 'error']) {
      await sample(100, {}, { status })
      await act(async () => container.querySelector('button')!.click())
    }
    expect(mocks.request).toHaveBeenCalledTimes(2)
  })

  it('collects for 1.5 seconds after settling and saves the median, not the last sample', async () => {
    expect(container.textContent).toContain('向きを保ってください')
    await samples(14)
    expect(mocks.save).not.toHaveBeenCalled()
    expect(container.textContent).toContain('測定しています')
    await sample(100, { alpha: 313 })
    expect(mocks.save).toHaveBeenCalledTimes(1)
    expect(mocks.save.mock.calls[0][0]).toEqual({ northCorrection: -45, calibratedAt: Date.now() })
    expect(container.textContent).toContain('準備完了')
    expect(container.querySelector('progress')!.value).toBe(1)
    expect(navigate).not.toHaveBeenCalled()
    await advance(599)
    expect(navigate).not.toHaveBeenCalled()
    await advance(1)
    expect(navigate).toHaveBeenCalledWith('/ar')
  })

  it('uses heading and rotation from the accepted event even when a separate state object disagrees', async () => {
    for (let i = 0; i < 30; i++) await sample(100, {}, { alpha: 0, compassHeading: 200 })
    expect(mocks.save).toHaveBeenCalledTimes(1)
    expect(mocks.save.mock.calls[0][0].northCorrection).toBeCloseTo(-45)
  })

  it('does not manufacture samples from timers or rerenders of the same accepted event', async () => {
    await sample(500)
    for (let i = 0; i < 30; i++) { await advance(100); await show() }
    expect(mocks.save).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('resets on screen orientation changes and ignores immediate post-change samples', async () => {
    await samples(10)
    await act(async () => {
      screenOrientation.angle = 90
      screenOrientation.dispatchEvent(new Event('change'))
    })
    expect(container.textContent).toContain('画面の向きが変わりました')
    await samples(10)
    expect(mocks.save).not.toHaveBeenCalled()
    await finish()
  })

  it('also resets via legacy orientationchange without the Screen Orientation API', async () => {
    await samples(10)
    await act(async () => window.dispatchEvent(new Event('orientationchange')))
    await samples(10)
    expect(mocks.save).not.toHaveBeenCalled()
    await finish()
  })

  it('discards hidden data and waits for a new complete interval after background return', async () => {
    let visibility: DocumentVisibilityState = 'visible'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
    await samples(10)
    await act(async () => { visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')) })
    await samples(30)
    expect(mocks.save).not.toHaveBeenCalled()
    await act(async () => { visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')) })
    expect(container.textContent).toContain('画面に戻りました')
    await samples(10)
    expect(mocks.save).not.toHaveBeenCalled()
    await finish()
  })

  it('resets on event type / absolute source changes', async () => {
    await samples(10)
    await sample(100, { eventType: 'deviceorientationabsolute', absolute: true })
    expect(container.textContent).toContain('取得条件が変わりました')
    await samples(10)
    expect(mocks.save).not.toHaveBeenCalled()
    await finish()
  })

  it.each(['screen', 'visibility', 'source'])('cancels already scheduled navigation when %s changes after completion', async boundary => {
    await finish()
    if (boundary === 'screen') await act(async () => window.dispatchEvent(new Event('orientationchange')))
    if (boundary === 'visibility') await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    if (boundary === 'source') await sample(100, { absolute: true })
    await advance(600)
    expect(navigate).not.toHaveBeenCalled()
    expect(mocks.save).toHaveBeenCalledTimes(1)
    await finish()
    await advance(600)
    expect(navigate).toHaveBeenCalledWith('/ar')
  })

  it.each([-1, 25])('holds for invalid/poor compass accuracy %s, and recovers when readings become usable', async accuracy => {
    await samples(35, { webkitCompassAccuracy: accuracy })
    expect(mocks.save).not.toHaveBeenCalled()
    expect(container.textContent).toContain(accuracy < 0 ? '未校正' : '精度が低下')
    await sample(100, { webkitCompassAccuracy: 5 })
    await finish()
  })

  it('allows devices without webkitCompassAccuracy to finish from stable samples', async () => {
    await samples(30, { webkitCompassAccuracy: undefined })
    expect(mocks.save).toHaveBeenCalledTimes(1)
  })

  it.each([{ beta: 60 }, { webkitCompassHeading: undefined }])('discards partial windows when required input becomes invalid (%o)', async invalid => {
    await samples(10)
    await sample(100, invalid)
    expect(mocks.save).not.toHaveBeenCalled()
    await sample(100, { beta: 90, webkitCompassHeading: 90 })
    await samples(10)
    expect(mocks.save).not.toHaveBeenCalled()
    await finish()
  })

  it('restarts after missing sensor updates instead of borrowing the old collection time', async () => {
    await samples(10)
    await sample(700)
    await samples(10)
    expect(mocks.save).not.toHaveBeenCalled()
    await finish()
  })

  it('updates the clock without creating sensor samples and cancels timers on unmount', async () => {
    const initial = new Date(container.querySelector('time')!.dateTime).getTime()
    await advance(1000)
    expect(container.querySelector('time')!.dateTime).toBe(new Date(initial + 1000).toISOString())
    expect(mocks.save).not.toHaveBeenCalled()
    await finish()
    await act(async () => root.unmount())
    await advance(1000)
    expect(navigate).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    root = createRoot(container)
  })
})
