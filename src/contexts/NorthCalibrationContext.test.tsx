// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { useNorthCalibration } from '../hooks/useNorthCalibration'

const sensor = vi.hoisted(() => ({ alpha: 315, heading: 90 }))

vi.mock('../hooks/useGeolocation', () => ({
  useGeolocation: () => ({ state: { status: 'idle' }, requestLocation: vi.fn() }),
}))
vi.mock('../hooks/useDeviceOrientation', () => ({
  useDeviceOrientation: () => {
    const event = { alpha: sensor.alpha, beta: 90, gamma: 0, absolute: false,
      webkitCompassHeading: sensor.heading, receivedAt: 1000, eventType: 'deviceorientation' }
    return {
      state: { ...event, status: 'active', compassHeading: sensor.heading, message: '' },
      requestPermission: vi.fn(), diagnostics: { lastAccepted: event, lastReceived: event },
    }
  },
}))
vi.mock('../pages/HomePage', () => ({
  HomePage: () => {
    const { northCorrection, calibrated, calibratedAt } = useNorthCalibration()
    return <output>{JSON.stringify({ northCorrection, calibrated, calibratedAt })}</output>
  },
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('app-wide north calibration lifetime', () => {
  it.each([{ alpha: 315, heading: 90, expected: -45 }, { alpha: 0, heading: 0, expected: 0 }])(
    '補正角$expected°を画面遷移で保持し、再マウント時に初期化する', async ({ alpha, heading, expected }) => {
      sensor.alpha = alpha
      sensor.heading = heading
      vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
      vi.stubEnv('DEV', true)
      const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
      vi.spyOn(Date, 'now').mockReturnValue(123456789)
      window.history.replaceState(null, '', '/debug')
      const container = document.createElement('div')
      document.body.append(container)
      let root = createRoot(container)
      const navigate = async (path: string) => {
        await act(async () => {
          window.history.pushState(null, '', path)
          window.dispatchEvent(new PopStateEvent('popstate'))
        })
      }
      try {
        await act(async () => root.render(<App />))
        expect(container.textContent).toContain('calibratedfalse')
        const button = [...container.querySelectorAll('button')].find((node) => node.textContent === '北基準を合わせる')!
        expect(button.disabled).toBe(false)
        await act(async () => button.click())
        expect(container.textContent).toContain('calibratedtrue')

        await navigate('/')
        expect(JSON.parse(container.querySelector('output')!.textContent!)).toEqual({
          northCorrection: expected, calibrated: true, calibratedAt: 123456789,
        })
        await navigate('/debug')
        expect(container.textContent).toContain(`northCorrection 保存値 (°)${expected.toFixed(4)}`)
        expect(container.textContent).toContain('calibratedtrue')
        expect(container.textContent).toContain('headingError (°)0.0000')

        // A new app tree models the in-memory lifetime ending on a page reload.
        await act(async () => root.unmount())
        root = createRoot(container)
        await act(async () => root.render(<App />))
        expect(container.textContent).toContain('calibratedfalse')
        expect(container.textContent).toContain('northCorrection 保存値 (°)null')
        await navigate('/')
        expect(JSON.parse(container.querySelector('output')!.textContent!)).toEqual({
          northCorrection: null, calibrated: false, calibratedAt: null,
        })
        expect(storageWrite).not.toHaveBeenCalled()
      } finally {
        await act(async () => root.unmount())
        container.remove()
      }
    },
  )
})
