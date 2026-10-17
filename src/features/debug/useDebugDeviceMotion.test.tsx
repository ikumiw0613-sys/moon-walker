// @vitest-environment jsdom
import { StrictMode, act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebugDeviceMotion } from './useDebugDeviceMotion'
import { MOTION_STALE_TIMEOUT_MS } from './gravityDiagnostics'

let root: ReturnType<typeof createRoot>
let sensor: ReturnType<typeof useDebugDeviceMotion>
function Probe() {
  const current = useDebugDeviceMotion()
  useEffect(() => { sensor = current }, [current])
  return null
}
async function mount() {
  await act(async () => root.render(<StrictMode><Probe /></StrictMode>))
}
async function enable() {
  await act(async () => { await sensor.requestPermission() })
}
async function send(sample: { x: number | null; y: number | null; z: number | null } | null = { x: 0, y: 0, z: 9.8 }) {
  const event = Object.assign(new Event('devicemotion'), { accelerationIncludingGravity: sample })
  await act(async () => window.dispatchEvent(event))
}
async function advance(ms: number) {
  await act(async () => vi.advanceTimersByTime(ms))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('DeviceMotionEvent', {})
  root = createRoot(document.createElement('div'))
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('debug DeviceMotion permissions', () => {
  it('自動で開始せず、iOS権限要求を操作内で同期的に呼び、二重要求を防ぐ', async () => {
    const permission = vi.fn().mockResolvedValue('granted')
    vi.stubGlobal('DeviceMotionEvent', { requestPermission: permission })
    await mount()
    expect(permission).not.toHaveBeenCalled()
    await send()
    expect(sensor.state.lastReceivedAt).toBeNull()
    await act(async () => {
      const first = sensor.requestPermission()
      expect(permission).toHaveBeenCalledTimes(1)
      await sensor.requestPermission()
      await first
    })
    expect(sensor.state.status).toBe('waiting')
    await send()
    expect(sensor.state.status).toBe('active')
    await enable()
    expect(permission).toHaveBeenCalledTimes(1)
  })

  it('権限APIなしのブラウザでもボタンから開始する', async () => {
    await mount()
    expect(sensor.state.status).toBe('idle')
    await enable()
    await send()
    expect(sensor.state).toMatchObject({ status: 'active', updating: true,
      accelerationIncludingGravity: { x: 0, y: 0, z: 9.8 }, lastReceivedAt: Date.now() })
  })

  it.each(['denied', 'error'] as const)('権限拒否または例外を表示し監視を開始しない: %s', async status => {
    const permission = status === 'denied' ? vi.fn().mockResolvedValue('denied') : vi.fn().mockRejectedValue(new Error('denied'))
    vi.stubGlobal('DeviceMotionEvent', { requestPermission: permission })
    await mount()
    await enable()
    await send()
    expect(sensor.state).toMatchObject({ status, updating: false, lastReceivedAt: null })
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['insecure', 'unsupported'])('HTTPS外・API未対応を安全に処理: %s', async mode => {
    if (mode === 'insecure') vi.stubGlobal('isSecureContext', false)
    else vi.stubGlobal('DeviceMotionEvent', undefined)
    await mount()
    await enable()
    expect(sensor.state.status).toBe('unsupported')
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('debug DeviceMotion filtering and freshness', () => {
  beforeEach(async () => { await mount(); await enable() })

  it('最終受信時刻と更新中を記録し、平滑化する', async () => {
    await send()
    await advance(100)
    await send({ x: 0, y: 9.8, z: 0 })
    expect(sensor.state.lastReceivedAt).toBe(Date.now())
    expect(sensor.state.updating).toBe(true)
    expect(sensor.state.filteredAcceleration!.y).toBeCloseTo(0.98)
    expect(sensor.state.filteredAcceleration!.z).toBeCloseTo(8.82)
  })

  it('初回未受信をタイムアウトし、次の受信で回復する', async () => {
    await advance(MOTION_STALE_TIMEOUT_MS)
    expect(sensor.state).toMatchObject({ status: 'unavailable', updating: false, lastReceivedAt: null })
    await send()
    expect(sensor.state.updating).toBe(true)
  })

  it('停止時は比較用の値を消し、再開時は古いフィルタを混ぜない', async () => {
    await send()
    const last = sensor.state.lastReceivedAt
    await advance(MOTION_STALE_TIMEOUT_MS - 1)
    expect(sensor.state.updating).toBe(true)
    await advance(1)
    expect(sensor.state).toMatchObject({ status: 'unavailable', updating: false, filteredAcceleration: null, lastReceivedAt: last })
    await send({ x: 9.8, y: 0, z: 0 })
    expect(sensor.state.filteredAcceleration).toEqual({ x: 9.8, y: 0, z: 0 })
  })

  it('静止して同じ値が連続しても更新中を維持する', async () => {
    for (let i = 0; i < 3; i++) { await send(); await advance(4000) }
    expect(sensor.state.updating).toBe(true)
  })

  it.each([null, { x: null, y: 0, z: 9.8 }, { x: NaN, y: 0, z: 9.8 }, { x: 0, y: 0, z: 100 }])(
    '無効な受信も生値として見せ、古い正常値を使わない: %s', async sample => {
      await send()
      await send(sample)
      expect(sensor.state.accelerationIncludingGravity).toEqual(sample)
      expect(sensor.state.filteredAcceleration).toBeNull()
      expect(sensor.state.updating).toBe(true)
      await send({ x: 9.8, y: 0, z: 0 })
      expect(sensor.state.filteredAcceleration).toEqual({ x: 9.8, y: 0, z: 0 })
    },
  )

  it('復帰時にタイマーが遅延していても停止を検出する', async () => {
    await send()
    vi.spyOn(performance, 'now').mockReturnValue(performance.now() + MOTION_STALE_TIMEOUT_MS)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    expect(sensor.state).toMatchObject({ updating: false, filteredAcceleration: null })
    await send({ x: 0, y: 9.8, z: 0 })
    expect(sensor.state.filteredAcceleration).toEqual({ x: 0, y: 9.8, z: 0 })
  })

  it('復帰直後のイベントでも受信間隔が空いていればフィルタを初期化する', async () => {
    await send()
    vi.spyOn(performance, 'now').mockReturnValue(performance.now() + MOTION_STALE_TIMEOUT_MS)
    await send({ x: 9.8, y: 0, z: 0 })
    expect(sensor.state.filteredAcceleration).toEqual({ x: 9.8, y: 0, z: 0 })
  })

  it('アンマウントで監視とタイマーを解除する', async () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const removeDocument = vi.spyOn(document, 'removeEventListener')
    await send()
    await act(async () => root.render(null))
    expect(vi.getTimerCount()).toBe(0)
    expect(remove).toHaveBeenCalledWith('devicemotion', expect.any(Function))
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    await send()
    expect(vi.getTimerCount()).toBe(0)
  })
})
