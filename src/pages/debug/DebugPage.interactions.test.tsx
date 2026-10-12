// @vitest-environment jsdom
import { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DebugPage } from './DebugPage'
import { NorthCalibrationProvider } from '../../features/north-calibration/NorthCalibrationProvider'
import type { LocationState } from '../../features/geolocation/types'

vi.mock('../../features/device-orientation/useDeviceOrientation', () => ({
  useDeviceOrientation: () => ({
    state: { status: 'idle', alpha: null, beta: null, gamma: null, absolute: false, compassHeading: null, message: '入力待ち' },
    diagnostics: { lastAccepted: null, lastReceived: null }, requestPermission: vi.fn(),
  }),
}))
vi.mock('../../features/moon/astronomy', () => ({
  getMoonPosition: (_latitude: number, _longitude: number, date: Date) => ({
    azimuth: 359, altitude: 10 + date.getUTCSeconds() / 10, isAboveHorizon: true,
  }),
}))

const location: LocationState = { status: 'success', location: { latitude: 35.68, longitude: 139.76, accuracy: 10, timestamp: 0 } }
let container: HTMLDivElement
let root: Root

beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-11T01:00:00Z'))
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<StrictMode><NorthCalibrationProvider>
    <DebugPage state={location} requestLocation={vi.fn()} />
  </NorthCalibrationProvider></StrictMode>))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function currentTime() {
  const select = container.querySelector('select')!
  await act(async () => {
    select.value = 'current'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function viewpoint() {
  return container.querySelector('[aria-labelledby="preview-title"] .debug-preview-data dd')!.textContent
}

async function pointer(target: HTMLElement, type: string, x: number, y: number) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { pointerType: 'mouse', pointerId: 1, button: 0, clientX: x, clientY: y })
  await act(async () => target.dispatchEvent(event))
}

it('ドラッグした視点を時刻更新でも保持し、月を正面に戻せる', async () => {
  await currentTime()
  expect(viewpoint()).toBe('359.0° / 10.0°')
  const preview = container.querySelector<HTMLElement>('[aria-labelledby="preview-title"] .debug-preview')!
  preview.setPointerCapture = vi.fn()
  preview.hasPointerCapture = vi.fn(() => true)
  preview.releasePointerCapture = vi.fn()
  await pointer(preview, 'pointerdown', 100, 100)
  await pointer(preview, 'pointermove', 110, 80)
  expect(viewpoint()).toBe('1.0° / 14.0°')
  expect(preview.classList.contains('is-dragging')).toBe(true)
  await pointer(preview, 'pointerup', 110, 80)
  expect(preview.classList.contains('is-dragging')).toBe(false)
  expect(preview.releasePointerCapture).toHaveBeenCalledWith(1)
  await act(async () => vi.advanceTimersByTime(1000))
  expect(container.querySelector('main')!.dataset.observationTime).toBe('2026-10-11T01:00:01.000Z')
  expect(viewpoint()).toBe('1.0° / 14.0°')
  const reset = [...container.querySelectorAll('button')].find(button => button.textContent === '月を正面にする')!
  await act(async () => reset.click())
  expect(viewpoint()).toBe('359.0° / 10.1°')
})

it('固定時刻に戻すと観測時刻を固定し、再び現在時刻にすると即時更新する', async () => {
  await currentTime()
  const select = container.querySelector('select')!
  await act(async () => {
    select.value = 'fixed'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  const fixed = container.querySelector('main')!.dataset.observationTime
  await act(async () => vi.advanceTimersByTime(5000))
  expect(container.querySelector('main')!.dataset.observationTime).toBe(fixed)
  await currentTime()
  expect(container.querySelector('main')!.dataset.observationTime).toBe('2026-10-11T01:00:05.000Z')
})

it('復帰時に現在時刻を更新し、アンマウント時にタイマーを解除する', async () => {
  const setInterval = vi.spyOn(window, 'setInterval')
  const clearInterval = vi.spyOn(window, 'clearInterval')
  const removeEventListener = vi.spyOn(document, 'removeEventListener')
  await currentTime()
  const interval = setInterval.mock.results[0]!.value
  expect(interval).toBeDefined()
  vi.setSystemTime(new Date('2026-10-11T01:02:00Z'))
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  expect(container.querySelector('main')!.dataset.observationTime).toBe('2026-10-11T01:02:00.000Z')
  await act(async () => root.render(null))
  expect(clearInterval).toHaveBeenCalledWith(interval)
  expect(removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
})
