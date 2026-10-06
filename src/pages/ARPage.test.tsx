import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ARPage } from './ARPage'

const mocks = vi.hoisted(() => ({
  calibration: { calibrated: true, northCorrection: -90 },
  orientation: { alpha: 0 as number | null, beta: 90, gamma: 0, status: 'active', message: 'センサー取得中' },
  moon: { azimuth: 90, altitude: 0, isAboveHorizon: true },
}))
vi.mock('../hooks/useNorthCalibration', () => ({ useNorthCalibration: () => mocks.calibration }))
vi.mock('../hooks/useDeviceOrientation', () => ({ useDeviceOrientation: () => ({ state: mocks.orientation, requestPermission: vi.fn() }) }))
vi.mock('../lib/astronomy', () => ({ getMoonPosition: () => mocks.moon }))

const render = () => renderToStaticMarkup(<ARPage navigate={vi.fn()} requestLocation={vi.fn()} state={{ status: 'success', location: { latitude: 35, longitude: 139, accuracy: 10, timestamp: 0 } }} />)

beforeEach(() => {
  mocks.calibration.calibrated = true
  mocks.calibration.northCorrection = -90
  mocks.orientation.alpha = 0
  mocks.orientation.status = 'active'
  mocks.moon.azimuth = 90
  mocks.moon.altitude = 0
  mocks.moon.isAboveHorizon = true
})

describe('AR moon guidance integration', () => {
  it('prioritizes the below-horizon notice over centered guidance', () => {
    mocks.moon.altitude = -1
    mocks.moon.isAboveHorizon = false
    const html = render()
    expect(html).toContain('mw-ar-below-horizon')
    expect(html).toContain('月は地平線の<br/>下にあります')
    expect(html).not.toContain('月はここ！')
    expect(html).not.toContain('mw-ar-ring')
    expect(html).not.toContain('月まで')
  })
  it('shows the below-horizon notice even without calibration or sensor data', () => {
    mocks.moon.isAboveHorizon = false
    mocks.calibration.calibrated = false
    mocks.orientation.alpha = null
    expect(render()).toContain('mw-ar-below-horizon')
    expect(render()).not.toContain('月を探す準備ができていません')
    expect(render()).not.toContain('センサー取得中')
  })
  it('uses saved north correction and rear camera forward', () => {
    const html = render()
    expect(html).toContain('月はここ！')
    expect(html).toContain('0.0°')
    expect(html).toContain('mw-ar-ring--centered')
  })
  it('updates direction and angle from moon position', () => {
    mocks.moon.azimuth = 135
    const html = render()
    expect(html).toContain('右へ')
    expect(html).toContain('45.0°')
    expect(html).not.toContain('mw-ar-ring--centered')
  })
  it('separates the opposite direction', () => {
    mocks.moon.azimuth = 270
    expect(render()).toContain('反対方向を向いてください')
    expect(render()).toContain('180.0°')
  })
  it('hides guidance when calibration is missing', () => {
    mocks.calibration.calibrated = false
    expect(render()).toContain('月を探す準備ができていません')
    expect(render()).not.toContain('0.0°')
  })
  it('does not fabricate angles when a sensor value is missing', () => {
    mocks.orientation.alpha = null
    expect(render()).toContain('センサー取得中')
    expect(render()).not.toContain('月はここ！')
  })
  it('shows permission button only when permission is needed', () => {
    mocks.orientation.alpha = null
    for (const status of ['idle', 'denied', 'error']) {
      mocks.orientation.status = status
      expect(render()).toContain('向きセンサーを許可する')
    }
    for (const status of ['requesting', 'waiting', 'active', 'unsupported', 'unavailable']) {
      mocks.orientation.status = status
      expect(render()).not.toContain('向きセンサーを許可する')
    }
  })
})
