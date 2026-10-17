// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { useDeviceMotion } from './useDeviceMotion'

it('iOS許可は操作時だけ要求し、許可済みなら次画面で自動再開する', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('isSecureContext', true)
  const permission = vi.fn().mockResolvedValue('granted')
  vi.stubGlobal('DeviceMotionEvent', { requestPermission: permission })
  const root = createRoot(document.createElement('div'))
  let motion: ReturnType<typeof useDeviceMotion>
  function Probe() {
    const current = useDeviceMotion({ autoStart: true })
    useEffect(() => { motion = current }, [current])
    return null
  }
  try {
    await act(async () => root.render(<Probe />))
    expect(motion!.state.status).toBe('idle')
    expect(permission).not.toHaveBeenCalled()
    await act(async () => { await motion!.requestPermission() })
    expect(permission).toHaveBeenCalledTimes(1)
    await act(async () => root.render(null))
    await act(async () => root.render(<Probe />))
    expect(motion!.state.status).toBe('waiting')
    expect(permission).toHaveBeenCalledTimes(1)
    const raw = { x: 0, y: -9.8, z: 0 }
    await act(async () => window.dispatchEvent(Object.assign(new Event('devicemotion'), { accelerationIncludingGravity: raw })))
    expect(motion!.state.accelerationIncludingGravity).toEqual(raw)
    expect(motion!.state.updating).toBe(true)
  } finally {
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  }
})
