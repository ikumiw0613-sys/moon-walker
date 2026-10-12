import { DeviceDiagnostics } from '../../features/debug/components/DeviceDiagnostics'
import { MoonTransformReadout } from '../../features/debug/components/MoonTransformReadout'
import { useScreenOrientationAngle } from '../../features/device-orientation/useScreenOrientationAngle'
import { useManualOrientation } from '../../features/debug/useManualOrientation'
import { useDebugObservation } from '../../features/debug/useDebugObservation'
import { useDebugView } from '../../features/debug/useDebugView'
import { diagnosticValue } from '../../features/debug/formatDiagnostics'
import { GeolocationControls } from '../../features/geolocation/GeolocationControls'
import type { GeolocationAccess } from '../../features/geolocation/types'
import { useDeviceOrientation } from '../../features/device-orientation/useDeviceOrientation'
import { projectDirectionToScreen } from '../../shared/math/coordinates'
import type { ScreenPosition } from '../../shared/math/coordinates'
import { getMoonNavigation } from '../../features/moon-guide/moonNavigation'
import { getMoonDeviceState, getMoonDeviceDiagnosticAttributes } from '../../features/moon-guide/moonDeviceNavigation'
import { captureNorthCalibration, getHorizontalCalibration } from '../../features/north-calibration/horizontalCalibration'
import { useNorthCalibration } from '../../features/north-calibration/useNorthCalibration'
import { SunDebugCard } from '../../features/debug/solar/SunDebugCard'
import { MoonPhasePreview } from '../../features/debug/moon/MoonPhasePreview'
import '../../features/debug/debug-base.css'
import './DebugPage.css'

export function DebugPage({ state, requestLocation }: GeolocationAccess) {
  const { state: sensorOrientation, requestPermission: requestOrientationPermission, diagnostics } = useDeviceOrientation()
  const { northCorrection, calibrated, calibratedAt, saveNorthCalibration } = useNorthCalibration()
  const screenAngle = useScreenOrientationAngle()
  const { manualOrientationEnabled, setManualOrientationEnabled, manualOrientation, setManualOrientation, orientation } = useManualOrientation(sensorOrientation)
  const { timeMode, changeTimeMode, observationDate, moonPosition } = useDebugObservation(state)
  const { viewAzimuth, viewAltitude, sensorMode, setSensorMode, isDragging, faceMoon,
    handlePointerDown, handlePointerMove, handlePointerEnd } = useDebugView({ state, timeMode, moonPosition })
  const transform = getMoonDeviceState(
    orientation, calibrated ? northCorrection : null, moonPosition, orientation.compassHeading,
  )

  const hasCompass = !manualOrientationEnabled && (orientation.absolute || orientation.compassHeading !== null)
  const sensorView = transform.correctedView
  const currentView = sensorMode ? sensorView : { azimuth: viewAzimuth, altitude: viewAltitude }
  const screenPosition: ScreenPosition | null = moonPosition && currentView
    ? projectDirectionToScreen(moonPosition.azimuth, moonPosition.altitude, currentView.azimuth, currentView.altitude)
    : null
  const navigation = sensorMode
    ? moonPosition && !moonPosition.isAboveHorizon
      ? { message: '現在、月は地平線の下にあります' } : transform.navigation
    : moonPosition && currentView ? getMoonNavigation(moonPosition, currentView) : null
  const rawEvent = diagnostics.lastAccepted
  const horizontalCalibration = getHorizontalCalibration(manualOrientationEnabled ? null : rawEvent)

  function handleManualNorthCalibration(): void {
    const sample = getHorizontalCalibration({ ...orientation, webkitCompassHeading: 0 })
    // oxlint-disable-next-line react/purity
    const captured = captureNorthCalibration(sample, Date.now())
    if (captured) saveNorthCalibration(captured)
  }

  function handleNorthCalibration(): void {
    // Timestamp is captured only on button click, never during render.
    // oxlint-disable-next-line react/purity
    const captured = captureNorthCalibration(horizontalCalibration, Date.now())
    if (captured) saveNorthCalibration(captured)
  }

  return (
    <main className="debug-screen" {...getMoonDeviceDiagnosticAttributes(transform, observationDate)}>
      <header className="debug-header">
        <div><p className="debug-eyebrow">MOON-WALKER / DEBUG</p>
          <h1>座標変換デバッグ</h1>
          <p className="search-status">位置情報 → 月の世界座標 → 端末座標の変換を確認します。</p>
          <p className="search-status">実機チェック: 手動テストをOFF → センサーを有効化 → 再読み込みせず北 → 東 → 南 → 西 → 北。各方向で数秒静止してください。</p>
        </div>
        <span className={`debug-status${transform.moonInDevice ? ' is-ready' : ''}`}>
          {transform.moonInDevice ? '計算中' : '入力待ち'}
        </span>
      </header>
      <div className="debug-grid">
        <section className="debug-panel" aria-labelledby="location-title">
          <h2 id="location-title"><span>01</span> 現在地と月</h2>
        <GeolocationControls state={state} onRequestLocation={requestLocation} />
          <label className="debug-time-mode">
            月の位置を計算する時刻
            <select value={timeMode} onChange={(event) => {
              const mode = event.target.value === 'current' ? 'current' : 'fixed'
              changeTimeMode(mode)
            }}>
              <option value="fixed">固定テスト日時</option>
              <option value="current">現在時刻（1秒ごとに更新）</option>
            </select>
          </label>
        {observationDate && (
          <p className="search-status">
            {timeMode === 'current' ? '現在時刻' : 'テスト日時（固定）'}: {observationDate.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}（日本時間）
          </p>
        )}
          <dl className="debug-data">
            <div><dt>月の方位角</dt><dd>{moonPosition?.azimuth.toFixed(2) ?? '—'}°</dd></div>
            <div><dt>月の高度</dt><dd>{moonPosition?.altitude.toFixed(2) ?? '—'}°</dd></div>
            <div><dt>地平線</dt><dd>{moonPosition ? moonPosition.isAboveHorizon ? '上' : '下' : '—'}</dd></div>
          </dl>
        </section>
        <section className="debug-panel" aria-labelledby="orientation-title">
          <h2 id="orientation-title"><span>02</span> 端末の向き</h2>
          <label>
            <input
              type="checkbox"
              checked={manualOrientationEnabled}
              onChange={(event) => {
                setManualOrientationEnabled(event.target.checked)
                setSensorMode(event.target.checked)
              }}
            />
            PCで向きを手動テストする
          </label>
          {manualOrientationEnabled && (
            <div className="orientation-test-controls">
              {([
                { axis: 'alpha', min: 0, max: 359 },
                { axis: 'beta', min: -180, max: 180 },
                { axis: 'gamma', min: -90, max: 90 },
              ] as const).map(({ axis, min, max }) => (
                <label key={axis}>
                  {axis}: {manualOrientation[axis]}°
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={1}
                    value={manualOrientation[axis]}
                    onChange={(event) => {
                      const value = Number(event.target.value)
                      setManualOrientation((previous) => ({ ...previous, [axis]: value }))
                    }}
                  />
                </label>
              ))}
              <p className="search-status">北補正を保存すると、向きの変更に合わせて共通計算のmoonInDeviceを表示します。</p>
            </div>
          )}
          <button
            className="find-moon-button"
            type="button"
            onClick={() => {
              setSensorMode(true)
              void requestOrientationPermission()
            }}
            disabled={['unsupported', 'requesting', 'waiting', 'active', 'unavailable'].includes(orientation.status)}
          >
            センサーを有効にする
          </button>
          <p className="search-status" role="status">{orientation.message}</p>
          <dl className="debug-data">
            <div><dt>入力元</dt><dd>{manualOrientationEnabled ? '手動' : '実機センサー'}</dd></div>
            <div><dt>センサー状態</dt><dd>{sensorOrientation.status}</dd></div>
            <div><dt>北基準</dt><dd>{hasCompass ? 'あり' : 'なし'}</dd></div>
          </dl>
          {sensorMode && orientation.status !== 'active' && (
            <button className="find-moon-button" type="button" onClick={() => setSensorMode(false)}>
              マウス操作に戻す
            </button>
          )}
          {orientation.status === 'active' && (
            <>
              <button className="find-moon-button" type="button" onClick={() => setSensorMode(!sensorMode)}>
                {sensorMode ? 'マウス操作に戻す' : manualOrientationEnabled ? '手動の向きで操作する' : 'スマホの向きで操作する'}
              </button>
              <p className="search-status">
                画面を自分に向け、端末の裏側を探したい空へ向けてください。
              </p>
              {!hasCompass && (
                <>
                  <p className="search-status">北基準の方位を取得できません。端末の裏側を北へ向け、基準を合わせてください。</p>
                  <button className="find-moon-button" type="button" disabled={!getHorizontalCalibration({ ...orientation, webkitCompassHeading: 0 }).canCalibrate} onClick={handleManualNorthCalibration}>
                    この方向を北にする
                  </button>
                </>
              )}
              {sensorMode && !sensorView && (
                <p className="search-status">向きを確定できません。北の基準を合わせ、端末を立ててください。</p>
              )}
            </>
          )}
          <p className="orientation-values">
            使用中 alpha: {diagnosticValue(orientation.alpha)}
            <br />
            使用中 beta: {diagnosticValue(orientation.beta)}
            <br />
            使用中 gamma: {diagnosticValue(orientation.gamma)}
          </p>
        </section>
        <DeviceDiagnostics sensorOrientation={sensorOrientation} diagnostics={diagnostics} transform={transform}
          horizontalCalibration={horizontalCalibration} manualOrientationEnabled={manualOrientationEnabled}
          screenAngle={screenAngle} northCorrection={northCorrection} calibrated={calibrated}
          calibratedAt={calibratedAt} onCalibrate={handleNorthCalibration} />
        <SunDebugCard state={state} correctedHeading={transform.correctedHeading} cameraForwardCorrected={transform.cameraForwardCorrected} />
        <MoonTransformReadout transform={transform} moonPosition={moonPosition} />
      </div>
      <section className="debug-panel" aria-labelledby="preview-title">
        <div className="debug-preview-heading"><h2 id="preview-title"><span>04</span> 画面投影プレビュー</h2>
          <button className="find-moon-button" type="button" disabled={!moonPosition} onClick={faceMoon}>月を正面にする</button>
        </div>
        <p className="search-status">{sensorMode ? '端末の向きで操作中' : 'マウスでドラッグして視点を変更'}。このプレビューは既存の方位角・高度による投影です。</p>
        <dl className="debug-data debug-preview-data">
          <div><dt>視点の方位 / 高度</dt><dd>{currentView ? `${currentView.azimuth.toFixed(1)}° / ${currentView.altitude.toFixed(1)}°` : '—'}</dd></div>
          <div><dt>画面 x / y</dt><dd>{screenPosition ? `${screenPosition.x.toFixed(1)}% / ${screenPosition.y.toFixed(1)}%` : '—'}</dd></div>
        </dl>
        <div className={`debug-preview${isDragging ? ' is-dragging' : ''}`}
          onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} onLostPointerCapture={handlePointerEnd}>
          <div className="debug-crosshair" aria-hidden="true" />
          <span className="debug-preview-label">{moonPosition ? 'VIEWPORT' : '現在地の取得待ち'}</span>
      {moonPosition?.isAboveHorizon && screenPosition?.isVisible && (
        <div
          className="moon-marker"
          style={{
            left: `${screenPosition.x}%`,
            top: `${screenPosition.y}%`,
          }}
        >
          🌕
        </div>
      )}
      {navigation && (
        <p className="debug-preview-navigation" role="status" aria-live="polite" aria-atomic="true">
          {navigation.message}
        </p>
      )}
        </div>
      </section>
      <MoonPhasePreview />
    </main>
  )
}
