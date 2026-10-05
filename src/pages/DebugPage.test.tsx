import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DebugPage } from './DebugPage'
import { NorthCalibrationProvider } from '../contexts/NorthCalibrationContext'

const mocked = vi.hoisted(() => ({ useDeviceOrientation: vi.fn() }))
vi.mock('../hooks/useDeviceOrientation', () => ({ useDeviceOrientation: mocked.useDeviceOrientation }))

afterEach(() => vi.unstubAllGlobals())

describe('debug diagnostic display', () => {
  it('未受信と未対応の値を区別して、全診断グループを表示する', () => {
    vi.stubGlobal('window', { screen: {} })
    mocked.useDeviceOrientation.mockReturnValue({
      state: { status: 'idle', alpha: null, beta: null, gamma: null, absolute: false, compassHeading: null, message: '' },
      requestPermission: vi.fn(), diagnostics: { lastReceived: null, lastAccepted: null },
    })
    const html = renderToStaticMarkup(<NorthCalibrationProvider><DebugPage state={{ status: 'idle' }} requestLocation={vi.fn()} /></NorthCalibrationProvider>)
    for (const label of ['raw sensor', 'compass', 'cameraForward before correction', 'cameraForward after correction', 'cameraForward after calibration', 'moon transform']) {
      expect(html).toContain(label)
    }
    expect(html).toContain('null (未受信)')
    expect(html).toContain('screen.orientation.angle (°)</dt><dd>unavailable')
    expect(html).toContain('moonInDeviceのベクトル長</dt><dd>null')
    expect(html).toContain('もう少し水平にしてください')
    expect(html).toContain('calibrated</dt><dd>false')
    expect(html).toContain('correctedHeading (°)</dt><dd>null')
    expect(html).toContain('headingError (°)</dt><dd>null')
    expect(html).toMatch(/disabled=""[^>]*>北基準を合わせる/)
  })

  it('採用イベントと無視された最終イベントを区別し、無効な精度も隠さない', () => {
    vi.stubGlobal('window', { screen: { orientation: { angle: 0 } } })
    const accepted = {
      alpha: 42, beta: 90.1, gamma: 0, absolute: true,
      eventType: 'deviceorientationabsolute', receivedAt: 1000,
      webkitCompassHeading: 90, webkitCompassAccuracy: -1,
    }
    mocked.useDeviceOrientation.mockReturnValue({
      state: { ...accepted, status: 'active', compassHeading: 90, message: '' },
      requestPermission: vi.fn(),
      diagnostics: { lastAccepted: accepted, lastReceived: { ...accepted, absolute: false, eventType: 'deviceorientation', receivedAt: 2000 } },
    })
    const html = renderToStaticMarkup(<NorthCalibrationProvider><DebugPage state={{ status: 'idle' }} requestLocation={vi.fn()} /></NorthCalibrationProvider>)
    expect(html).toContain('使用中のイベント種別</dt><dd>deviceorientationabsolute')
    expect(html).toContain('最終受信イベント種別</dt><dd>deviceorientation')
    expect(html).toContain('既存条件により無視')
    expect(html).toContain('webkitCompassAccuracy (°)</dt><dd>-1.0000')
    expect(html).toContain('コンパス精度が負の値')
    expect(html).toContain('azimuth (°)</dt><dd>270.0000')
    expect(html).toContain('キャリブレーション可能')
    expect(html).toContain('northCorrection 候補 (°)</dt><dd>-132.0000')
    expect(html).toContain('northCorrection 保存値 (°)</dt><dd>null')
    expect(html).toContain('cameraForwardRaw')
  })

  it('水平でもwebkitCompassHeadingがなければボタンを無効にする', () => {
    vi.stubGlobal('window', { screen: {} })
    const accepted = { alpha: 0, beta: 90, gamma: 0, absolute: true, receivedAt: 1000, eventType: 'deviceorientationabsolute' }
    mocked.useDeviceOrientation.mockReturnValue({
      state: { ...accepted, status: 'active', compassHeading: null, message: '' },
      requestPermission: vi.fn(), diagnostics: { lastAccepted: accepted, lastReceived: accepted },
    })
    const html = renderToStaticMarkup(<NorthCalibrationProvider><DebugPage state={{ status: 'idle' }} requestLocation={vi.fn()} /></NorthCalibrationProvider>)
    expect(html).toContain('コンパス方位を取得できません')
    expect(html).toMatch(/disabled=""[^>]*>北基準を合わせる/)
  })
})
