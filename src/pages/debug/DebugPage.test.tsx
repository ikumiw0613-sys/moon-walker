import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DebugPage } from './DebugPage'
import { NorthCalibrationProvider } from '../../features/north-calibration/NorthCalibrationProvider'

const mocked = vi.hoisted(() => ({ useDeviceOrientation: vi.fn() }))
vi.mock('../../features/device-orientation/useDeviceOrientation', () => ({ useDeviceOrientation: mocked.useDeviceOrientation }))

afterEach(() => vi.unstubAllGlobals())

describe('debug diagnostic display', () => {
  it('未受信と未対応の値を区別して、全診断グループを表示する', () => {
    vi.stubGlobal('window', { screen: {} })
    mocked.useDeviceOrientation.mockReturnValue({
      state: { status: 'idle', alpha: null, beta: null, gamma: null, absolute: false, compassHeading: null, message: '' },
      requestPermission: vi.fn(), diagnostics: { lastReceived: null, lastAccepted: null },
    })
    const html = renderToStaticMarkup(<NorthCalibrationProvider><DebugPage state={{ status: 'idle' }} requestLocation={vi.fn()} /></NorthCalibrationProvider>)
    for (const label of ['raw sensor', 'compass', 'cameraForward before correction', 'corrected cameraForward / ENU', 'Moon transform pipeline', '姿勢診断 / Gravity']) {
      expect(html).toContain(label)
    }
    expect(html).toContain('null (未受信)')
    expect(html).toContain('screen.orientation.angle (°)</dt><dd>unavailable')
    expect(html).toContain('moonInDeviceのベクトル長</dt><dd>null')
    expect(html).toContain('もう少し水平にしてください')
    expect(html).toContain('calibrated</dt><dd>false')
    expect(html).toContain('correctedHeading (°)</dt><dd>null')
    expect(html).toContain('headingError (°)</dt><dd>null')
    for (const label of ['moon.azimuth (°)', 'moon.altitude (°)', 'correctedAltitude (°)', 'moonScreen.x', 'moonScreen.y', 'moonScreen.visible', 'navigation.angleToMoon (°)', 'navigation.status']) {
      expect(html).toContain(`${label}</dt><dd>null`)
    }
    for (const reason of ['location unavailable', 'moon position unavailable', 'correctedRotation unavailable', 'moonInDevice unavailable']) {
      expect(html).toContain(reason)
    }
    expect(html).toContain('Moon diagnostics をコピー')
    expect(html).toContain('Pose stability')
    expect(html).toContain('pose stability status</dt><dd>unavailable')
    expect(html).toContain('pose stability reason</dt><dd>orientation unavailable')
    expect(html).toContain('heading delta (°)</dt><dd>null')
    expect(html).toContain('pose.stability: unavailable')
    expect(html).toContain('算出不可: DeviceMotion未対応')
    expect(html).toContain('北補正候補の比較')
    expect(html).toContain('candidate status</dt><dd>device rotation unavailable')
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
    expect(html).toContain('webkitCompassAccuracy (°)</dt><dd>-1.00')
    expect(html).toContain('コンパス精度が負の値')
    expect(html).toContain('azimuth (°)</dt><dd>318.00')
    expect(html).toContain('北補正の入力元</dt><dd>なし')
    expect(html).toContain('data-corrected-rotation="null"')
    expect(html).toContain('キャリブレーション可能')
    expect(html).toContain('cameraForward / ENU軸表記・補正前')
    expect(html).toContain('candidate northCorrection</dt><dd>-132.0°')
    expect(html).toContain('saved northCorrection</dt><dd>null')
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
    expect(html).toContain('candidate status</dt><dd>compass unavailable')
    expect(html).toMatch(/disabled=""[^>]*>北基準を合わせる/)
  })
})
