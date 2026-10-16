// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalibrationPage } from './CalibrationPage'
import { ObservationTimeProvider } from '../../shared/time/ObservationTimeProvider'

const mocks = vi.hoisted(() => ({
  state: { status: 'active', alpha: 315, beta: 90, gamma: 0, compassHeading: 90 as number | null, message: '' },
  save: vi.fn(), request: vi.fn(), retry: vi.fn(),
}))
vi.mock('../../features/device-orientation/useDeviceOrientation', () => ({ useDeviceOrientation: () => ({ state: mocks.state, requestPermission: mocks.request, retryConnection: mocks.retry }) }))
vi.mock('../../features/north-calibration/useNorthCalibration', () => ({ useNorthCalibration: () => ({ saveNorthCalibration: mocks.save }) }))

let root: Root
let container: HTMLDivElement
let now: number
const navigate = vi.fn()
async function sample(ms = 100, beta = 90, compassHeading: number | null = 90) {
  now += ms
  mocks.state = { ...mocks.state, beta, compassHeading }
  await act(async () => root.render(<ObservationTimeProvider><CalibrationPage navigate={navigate} /></ObservationTimeProvider>))
}
async function hold() {
  for (let i = 0; i < 7; i++) await sample()
}
beforeEach(async () => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  mocks.state = { status: 'active', alpha: 315, beta: 90, gamma: 0, compassHeading: 90, message: '' }
  mocks.save.mockClear()
  mocks.request.mockClear()
  mocks.retry.mockClear()
  navigate.mockClear()
  container = document.createElement('div')
  root = createRoot(container)
  await act(async () => root.render(<ObservationTimeProvider><CalibrationPage navigate={navigate} /></ObservationTimeProvider>))
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('automatic calibration', () => {
  it('許可要求APIの有無によらず、未受信時は再接続し、待機中は再試行ボタンを出さない', async () => {
    for (const api of [{}, { requestPermission: vi.fn() }]) {
      vi.stubGlobal('DeviceOrientationEvent', api)
      mocks.state.status = 'unavailable'
      await sample()
      const button = container.querySelector('button')!
      expect(button.textContent).toBe('向きセンサーに再接続する')
      await act(async () => button.click())
      expect(mocks.request).not.toHaveBeenCalled()
      mocks.state.status = 'waiting'
      await sample()
      expect(container.querySelector('button')).toBeNull()
    }
    expect(mocks.retry).toHaveBeenCalledTimes(2)
  })

  it('許可拒否と開始エラーでは許可要求をやり直す', async () => {
    for (const status of ['denied', 'error']) {
      mocks.state.status = status
      await sample()
      const button = container.querySelector('button')!
      expect(button.textContent).toBe('向きセンサーを許可する')
      await act(async () => button.click())
    }
    expect(mocks.request).toHaveBeenCalledTimes(2)
    expect(mocks.retry).not.toHaveBeenCalled()
  })
  it('補正完了直後にバックグラウンドへ移った場合、自動遷移を止めて新しい値で補正し直す', async () => {
    let visibility: DocumentVisibilityState = 'visible'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
    await hold()
    expect(mocks.save).toHaveBeenCalledTimes(1)
    await act(async () => {
      visibility = 'hidden'
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await act(async () => vi.advanceTimersByTime(1000))
    await hold()
    expect(navigate).not.toHaveBeenCalled()
    expect(mocks.save).toHaveBeenCalledTimes(1)
    await act(async () => {
      visibility = 'visible'
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await sample()
    for (let i = 0; i < 6; i++) await sample()
    expect(mocks.save).toHaveBeenCalledTimes(1)
    await sample()
    expect(mocks.save).toHaveBeenCalledTimes(2)
    await act(async () => vi.advanceTimersByTime(600))
    expect(navigate).toHaveBeenCalledWith('/ar')
  })
  it('現在時刻を毎秒更新し、画面復帰時にも更新する', async () => {
    const initial = new Date(container.querySelector('time')!.dateTime).getTime()
    await act(async () => vi.advanceTimersByTime(1000))
    expect(container.querySelector('time')!.dateTime).toBe(new Date(initial + 1000).toISOString())
    vi.setSystemTime(new Date(initial + 60000))
    await act(async () => window.dispatchEvent(new Event('focus')))
    expect(container.querySelector('time')!.dateTime).toBe(new Date(initial + 60000).toISOString())
  })
  it('saves the existing correction after 700ms of continuous samples and navigates after 600ms', async () => {
    for (let i = 0; i < 6; i++) await sample()
    expect(mocks.save).not.toHaveBeenCalled()
    await sample()
    expect(mocks.save).toHaveBeenCalledTimes(1)
    expect(mocks.save.mock.calls[0][0].northCorrection).toBeCloseTo(-45)
    expect(container.textContent).toContain('準備完了')
    expect(navigate).not.toHaveBeenCalled()
    await sample()
    expect(mocks.save).toHaveBeenCalledTimes(1)
    await act(async () => vi.advanceTimersByTime(599))
    expect(navigate).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTime(1))
    expect(navigate).toHaveBeenCalledWith('/ar')
    expect(container.querySelector('a[href="/ar"]')).toBeNull()
    expect(container.textContent).not.toContain('北基準を保存')
  })
  it('a single qualifying frame never completes', async () => {
    await act(async () => vi.advanceTimersByTime(5000))
    expect(mocks.save).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
  it('resets when horizontalLength falls below 0.9', async () => {
    for (let i = 0; i < 6; i++) await sample()
    await sample(100, 60)
    expect(container.textContent).not.toContain('準備完了')
    await sample()
    for (let i = 0; i < 6; i++) await sample()
    expect(mocks.save).not.toHaveBeenCalled()
    await sample()
    expect(mocks.save).toHaveBeenCalledTimes(1)
  })
  it('requires compass data throughout the hold', async () => {
    for (let i = 0; i < 10; i++) await sample(100, 90, null)
    expect(mocks.save).not.toHaveBeenCalled()
    expect(container.textContent).not.toContain('準備完了')
    await sample()
    await hold()
    expect(mocks.save).toHaveBeenCalledTimes(1)
  })
  it('resets the hold after a gap in sensor samples', async () => {
    for (let i = 0; i < 6; i++) await sample()
    await sample(300)
    expect(mocks.save).not.toHaveBeenCalled()
    await hold()
    expect(mocks.save).toHaveBeenCalledTimes(1)
  })
  it('cancels navigation when the page is unmounted', async () => {
    await hold()
    await act(async () => root.unmount())
    await act(async () => vi.advanceTimersByTime(1000))
    expect(navigate).not.toHaveBeenCalled()
    root = createRoot(container)
  })
})
