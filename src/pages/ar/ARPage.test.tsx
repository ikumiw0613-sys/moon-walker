// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ARPage } from './ARPage'

const mocks = vi.hoisted(() => ({
  calibration: { calibrated: true, northCorrection: -90 },
  orientation: { alpha: 0 as number | null, beta: 90, gamma: 0, status: 'active', message: 'センサー取得中' },
  moon: { azimuth: 90, altitude: 0, isAboveHorizon: true },
  phase: { ageDays: 7, cycleAngle: 90, illuminatedFraction: 0.5 },
  retry: vi.fn(), request: vi.fn(),
}))
vi.mock('../../features/north-calibration/useNorthCalibration', () => ({ useNorthCalibration: () => mocks.calibration }))
vi.mock('../../features/device-orientation/useDeviceOrientation', () => ({ useDeviceOrientation: () => ({ state: mocks.orientation, requestPermission: mocks.request, retryConnection: mocks.retry }) }))
vi.mock('../../features/moon/astronomy', () => ({ getMoonPosition: () => mocks.moon }))
vi.mock('../../features/moon/moonPhase', () => ({ getMoonPhase: () => mocks.phase }))

const render = () => renderToStaticMarkup(<ARPage navigate={vi.fn()} requestLocation={vi.fn()} state={{ status: 'success', location: { latitude: 35, longitude: 139, accuracy: 10, timestamp: 0 } }} />)

beforeEach(() => {
  mocks.retry.mockClear()
  mocks.request.mockClear()
  mocks.calibration.calibrated = true
  mocks.calibration.northCorrection = -90
  mocks.orientation.alpha = 0
  mocks.orientation.status = 'active'
  mocks.moon.azimuth = 90
  mocks.moon.altitude = 0
  mocks.moon.isAboveHorizon = true
  mocks.phase.ageDays = 7
  mocks.phase.cycleAngle = 90
  mocks.phase.illuminatedFraction = 0.5
})

describe('AR moon guidance integration', () => {
  it('未受信時の再接続ボタンは、許可要求ではなく受信監視の再試行を呼ぶ', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const container = document.createElement('div')
    const root = createRoot(container)
    const show = () => root.render(<ARPage navigate={vi.fn()} requestLocation={vi.fn()} state={{ status: 'success', location: { latitude: 35, longitude: 139, accuracy: 10, timestamp: 0 } }} />)
    try {
      mocks.orientation.status = 'unavailable'
      await act(async () => show())
      const button = container.querySelector('button')!
      expect(button.textContent).toBe('向きセンサーに再接続する')
      await act(async () => button.click())
      expect(mocks.retry).toHaveBeenCalledTimes(1)
      expect(mocks.request).not.toHaveBeenCalled()
      mocks.orientation.status = 'waiting'
      await act(async () => show())
      expect(container.querySelector('button')).toBeNull()
      expect(container.querySelector('.moon-sprite')).toBeNull()
    } finally {
      await act(async () => root.unmount())
      vi.unstubAllGlobals()
    }
  })
  it('センサー停止時は数値が残っていても月・マーカー・案内を表示しない', () => {
    mocks.orientation.status = 'unavailable'
    for (const azimuth of [90, 150, 270]) {
      mocks.moon.azimuth = azimuth
      const html = render()
      expect(html).toContain('スマホの向きを確認')
      expect(html).not.toContain('moon-sprite')
      expect(html).not.toContain('mw-ar-moon-marker')
      expect(html).not.toContain('mw-ar-ring')
      expect(html).not.toContain('月まで')
    }
    mocks.orientation.status = 'active'
    mocks.moon.azimuth = 90
    expect(render()).toContain('月はここ！')
  })
  it('prioritizes the below-horizon notice over centered guidance', () => {
    mocks.moon.altitude = -1
    mocks.moon.isAboveHorizon = false
    const html = render()
    expect(html).toContain('mw-ar-below-horizon')
    expect(html).toContain('月は地平線の<br/>下にあります')
    expect(html).not.toContain('月はここ！')
    expect(html).not.toContain('mw-ar-ring')
    expect(html).not.toContain('moon-sprite')
    expect(html).not.toContain('mw-ar-moon-marker')
    expect(html).not.toContain('月まで')
    expect(html).not.toContain('moon-shadow')
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
    expect(html).toContain('moon-sprite')
    expect(html).not.toContain('mw-ar-moon-marker')
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
    const html = render()
    expect(html).toContain('反対方向を向いてください')
    expect(html).toContain('180.0°')
    expect(html).not.toContain('moon-sprite')
    expect(html).toContain('mw-ar-moon-marker')
    expect(html).toContain('反対側に月')
  })
  it('shows a direction marker when the Moon is in front but outside the viewport', () => {
    mocks.moon.azimuth = 150
    const html = render()
    expect(html).toContain('右へ')
    expect(html).toContain('60.0°')
    expect(html).not.toContain('moon-sprite')
    expect(html).toContain('mw-ar-moon-marker')
    expect(html).toContain('画面外に月')
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

  it('月本体と画面端のマーカーが同じ月相の影を描画する', () => {
    const container = document.createElement('div')
    container.innerHTML = render()
    const mainShadow = container.querySelector('.moon-sprite .moon-shadow')!
    expect(mainShadow).not.toBeNull()
    const mainPath = mainShadow.getAttribute('d')

    mocks.moon.azimuth = 270
    container.innerHTML = render()
    const markerShadow = container.querySelector('.mw-ar-moon-thumbnail .moon-shadow')!
    expect(markerShadow).not.toBeNull()
    expect(markerShadow.getAttribute('d')).toBe(mainPath)

    mocks.phase.cycleAngle = 270
    container.innerHTML = render()
    expect(container.querySelector('.moon-shadow')!.getAttribute('d')).not.toBe(mainPath)
  })

  it('満月では本体とマーカーの影を外し、月画像は表示する', () => {
    mocks.phase.cycleAngle = 180
    mocks.phase.illuminatedFraction = 1
    const container = document.createElement('div')
    for (const azimuth of [90, 270]) {
      mocks.moon.azimuth = azimuth
      container.innerHTML = render()
      expect(container.querySelector('.moon-disc image')).not.toBeNull()
      expect(container.querySelector('.moon-shadow')).toBeNull()
    }
  })
})
