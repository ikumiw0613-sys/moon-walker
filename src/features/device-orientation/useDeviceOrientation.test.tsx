// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDeviceOrientation } from './useDeviceOrientation'

it('resumes on the next page without requesting permission again', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('isSecureContext', true)
  const permission = vi.fn().mockResolvedValue('granted')
  vi.stubGlobal('DeviceOrientationEvent', { requestPermission: permission })
  let sensor: ReturnType<typeof useDeviceOrientation> | undefined
  function Probe({ autoStart = false }: { autoStart?: boolean }) {
    const current = useDeviceOrientation({ autoStart })
    useEffect(() => { sensor = current }, [current])
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(async () => root.render(<Probe autoStart />))
    expect(sensor!.state.status).toBe('idle')
    expect(permission).not.toHaveBeenCalled()
    await act(async () => { await sensor!.requestPermission() })
    expect(permission).toHaveBeenCalledTimes(1)
    await act(async () => vi.advanceTimersByTime(5000))
    expect(sensor!.state.status).toBe('unavailable')
    await act(async () => sensor!.retryConnection())
    expect(sensor!.state.status).toBe('waiting')
    expect(permission).toHaveBeenCalledTimes(1)
    await act(async () => root.render(null))
    await act(async () => root.render(<Probe autoStart />))
    expect(sensor!.state.status).toBe('waiting')
    const event = new Event('deviceorientation')
    Object.assign(event, { alpha: 0, beta: 90, gamma: 0, absolute: true })
    await act(async () => window.dispatchEvent(event))
    expect(sensor!.state.status).toBe('active')
    expect(permission).toHaveBeenCalledTimes(1)
  } finally {
    await act(async () => root.unmount())
    vi.useRealTimers()
    vi.unstubAllGlobals()
  }
})

describe('向きセンサーの更新停止', () => {
  let root: ReturnType<typeof createRoot>
  let sensor: ReturnType<typeof useDeviceOrientation>
  function Probe() {
    const current = useDeviceOrientation({ autoStart: true })
    useEffect(() => { sensor = current }, [current])
    return null
  }
  async function send(values = { alpha: 0 as number | null, beta: 90 as number | null, gamma: 0 as number | null, absolute: true }) {
    const event = Object.assign(new Event('deviceorientation'), values, { webkitCompassHeading: 90 })
    await act(async () => window.dispatchEvent(event))
  }
  async function advance(ms: number) {
    await act(async () => vi.advanceTimersByTime(ms))
  }
  beforeEach(async () => {
    vi.useFakeTimers()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('isSecureContext', true)
    vi.stubGlobal('DeviceOrientationEvent', {})
    root = createRoot(document.createElement('div'))
    await act(async () => root.render(<Probe />))
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('初回受信も5秒待って届かなければ未取得とする', async () => {
    await advance(4999)
    expect(sensor.state.status).toBe('waiting')
    await advance(1)
    expect(sensor.state.status).toBe('unavailable')
    expect(sensor.state.message).toContain('センサー値が届いていません')
  })

  it('再接続は監視を一度だけ作り直し、受信がなければ再びタイムアウトする', async () => {
    await advance(5000)
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    await act(async () => {
      sensor.retryConnection()
      sensor.retryConnection()
    })
    expect(sensor.state.status).toBe('waiting')
    expect(sensor.state.alpha).toBeNull()
    expect(add.mock.calls.filter(([name]) => name === 'deviceorientation')).toHaveLength(1)
    expect(remove.mock.calls.filter(([name]) => name === 'deviceorientation')).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(1)
    await advance(4999)
    expect(sensor.state.status).toBe('waiting')
    await advance(1)
    expect(sensor.state.status).toBe('unavailable')
    await act(async () => sensor.retryConnection())
    await send()
    expect(sensor.state.status).toBe('active')
  })

  it('稼働中と初回受信待ちには再接続せず、停止後の再接続では古い診断値も消す', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    await act(async () => sensor.retryConnection())
    expect(add).not.toHaveBeenCalled()
    await send()
    await act(async () => sensor.retryConnection())
    expect(add).not.toHaveBeenCalled()
    await advance(5000)
    expect(sensor.diagnostics.lastAccepted).not.toBeNull()
    await act(async () => sensor.retryConnection())
    expect(sensor.diagnostics).toEqual({ lastReceived: null, lastAccepted: null })
    // 前の接続で採用した絶対方位の優先状態も、新しい接続には持ち越さない。
    await send({ alpha: 45, beta: 90, gamma: 0, absolute: false })
    expect(sensor.state).toMatchObject({ status: 'active', alpha: 45 })
  })

  it('最後の採用から5秒で古い姿勢と方位を消し、新しい受信で復帰する', async () => {
    await send()
    await advance(4999)
    expect(sensor.state.status).toBe('active')
    await advance(1)
    expect(sensor.state).toMatchObject({ status: 'unavailable', alpha: null, beta: null, gamma: null, compassHeading: null })
    expect(sensor.state.message).toContain('月の案内を停止')
    await send({ alpha: 45, beta: 90, gamma: 0, absolute: true })
    expect(sensor.state).toMatchObject({ status: 'active', alpha: 45 })
    await advance(5000)
    expect(sensor.state.status).toBe('unavailable')
  })

  it('同じ角度のイベントが届いていれば停止とは判定しない', async () => {
    await send()
    for (let i = 0; i < 3; i++) {
      await advance(4000)
      await send()
    }
    await advance(4999)
    expect(sensor.state.status).toBe('active')
    await advance(1)
    expect(sensor.state.status).toBe('unavailable')
  })

  it('全角度nullや採用しない相対イベントでは受信期限を延長しない', async () => {
    await send()
    await advance(2000)
    await send({ alpha: null, beta: null, gamma: null, absolute: true })
    await advance(2000)
    await send({ alpha: 45, beta: 90, gamma: 0, absolute: false })
    await advance(1000)
    expect(sensor.state.status).toBe('unavailable')
  })

  it('タイマーが遅延していても画面復帰時に古い値を使わない', async () => {
    await send()
    vi.spyOn(performance, 'now').mockReturnValue(performance.now() + 6000)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    expect(sensor.state.status).toBe('unavailable')
  })

  it('アンマウント時に監視タイマーを解除する', async () => {
    await send()
    expect(vi.getTimerCount()).toBe(1)
    await act(async () => root.render(null))
    expect(vi.getTimerCount()).toBe(0)
    await send()
    expect(vi.getTimerCount()).toBe(0)
  })
})
