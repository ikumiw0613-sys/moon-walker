// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { useDeviceOrientation } from './useDeviceOrientation'

it('resumes on the next page without requesting permission again', async () => {
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
    vi.unstubAllGlobals()
  }
})
