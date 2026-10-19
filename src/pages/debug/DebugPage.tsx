import { useState } from 'react'
import { usePoseStability } from '../../features/device-orientation/usePoseStability'
import type { GravitySensorConvention } from '../../features/device-motion/gravityDiagnostics'
import { useCompassDiagnostics } from '../../features/debug/useCompassDiagnostics'
import { CompassStabilityDiagnostics } from '../../features/debug/components/CompassStabilityDiagnostics'
import { DiagnosticSnapshots } from '../../features/debug/components/DiagnosticSnapshots'
import { SkytreeDebugCard } from '../../features/debug/components/SkytreeDebugCard'
import { getLandmarkCompassDiagnostics } from '../../features/debug/landmarkCompassDiagnostics'
import { HORIZONTAL_CALIBRATION_THRESHOLD } from '../../features/north-calibration/horizontalCalibration'
import { getAuxiliaryGravity } from '../../features/device-orientation/auxiliaryGravity'
import { cameraVectorToViewAngles } from '../../features/sky/skyParallax'
import { DeviceDiagnostics } from '../../features/debug/components/DeviceDiagnostics'
import { NorthCorrectionDiagnostics } from '../../features/debug/components/NorthCorrectionDiagnostics'
import { deviceOrientationToMatrix } from '../../features/device-orientation/deviceRotation'
import { MoonTransformReadout } from '../../features/debug/components/MoonTransformReadout'
import { GravityDiagnostics } from '../../features/debug/components/GravityDiagnostics'
import { useDebugDeviceMotion } from '../../features/debug/useDebugDeviceMotion'
import { useScreenOrientationAngle } from '../../features/device-orientation/useScreenOrientationAngle'
import { useManualOrientation } from '../../features/debug/useManualOrientation'
import { useDebugObservation } from '../../features/debug/useDebugObservation'
import { useDebugView } from '../../features/debug/useDebugView'
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
  const { state: motion, requestPermission: requestMotionPermission } = useDebugDeviceMotion()
  const [gravityConvention, setGravityConvention] = useState<GravitySensorConvention>('raw-is-down')
  const { northCorrection, calibrated, calibratedAt, saveNorthCalibration } = useNorthCalibration()
  const screenAngle = useScreenOrientationAngle()
  const { manualOrientationEnabled, setManualOrientationEnabled, manualOrientation, setManualOrientation, orientation } = useManualOrientation(sensorOrientation)
  const { timeMode, changeTimeMode, observationDate, moonPosition } = useDebugObservation(state)
  const { viewAzimuth, viewAltitude, sensorMode, setSensorMode, isDragging, faceMoon,
    handlePointerDown, handlePointerMove, handlePointerEnd } = useDebugView({ state, timeMode, moonPosition })
  const transform = getMoonDeviceState(
    orientation, calibrated ? northCorrection : null, moonPosition, orientation.compassHeading,
  )
  const poseStability = usePoseStability({ rotation: transform.correctedRotation, heading: transform.correctedHeading,
    active: !manualOrientationEnabled && sensorOrientation.status === 'active',
    sampleId: diagnostics.lastAccepted?.sequence ?? diagnostics.lastAccepted?.receivedAt ?? null, calibrationKey: calibrated ? northCorrection : null,
    motion, gravityConvention })

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
  const compass = useCompassDiagnostics(rawEvent, sensorOrientation.status === 'active', manualOrientationEnabled)
  const landmark = getLandmarkCompassDiagnostics({ state,
    compassHeading: compass.current?.heading ?? null,
    webkitCompassAccuracy: compass.current ? rawEvent?.webkitCompassAccuracy : null,
    correctedHeading: compass.current ? transform.correctedHeading : null,
    rawHeading: compass.current ? transform.rawView?.azimuth ?? null : null,
  })
  const gravity = !manualOrientationEnabled && sensorOrientation.status === 'active'
    ? getAuxiliaryGravity(motion, transform.correctedRotation, compass.now, gravityConvention)
    : { angle: null, reason: '実機姿勢の取得待ち' }
  const horizontalCalibration = getHorizontalCalibration(manualOrientationEnabled ? null : rawEvent)
  const { alpha, beta, gamma } = sensorOrientation
  const sensorRotation = alpha !== null && beta !== null && gamma !== null
    && [alpha, beta, gamma].every(Number.isFinite) ? deviceOrientationToMatrix(alpha, beta, gamma) : null

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
          <h1>座標変換・コンパス診断</h1>
          <p className="search-status">位置情報 → 月の世界座標 → 端末座標の変換を確認します。</p>
          <p className="search-status">場所比較: 現在時刻・手動テストOFF → 屋外で北基準を合わせる → 同じ向きで約3秒静止 → 記録。移動先でも同じように記録してください。</p>
        </div>
        <span className={`debug-status${transform.moonInDevice ? ' is-ready' : ''}`}>
          {transform.moonInDevice ? '計算中' : '入力待ち'}
        </span>
      </header>
      <div className="debug-grid">
        <section className="debug-panel" aria-labelledby="location-title">
          <h2 id="location-title"><span>A</span> Summary / 状態概要</h2>
          <dl className="debug-data">
            <div><dt>現在時刻（日本時間）</dt><dd>{new Date(compass.now).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</dd></div>
            <div><dt>センサー状態</dt><dd>{sensorOrientation.status}</dd></div>
            <div><dt>orientation source</dt><dd>{manualOrientationEnabled ? 'manual' : rawEvent?.eventType ?? 'sensor（未受信）'}</dd></div>
            <div><dt>north calibration</dt><dd>{calibrated ? '保存済み' : '未校正'}</dd></div>
            <div><dt>pose stability</dt><dd>{poseStability.status}</dd></div>
            <div><dt>gravity reliability</dt><dd>{gravity.reason ?? 'available'}</dd></div>
            <div><dt>月の位置が計算可能か</dt><dd>{moonPosition ? '計算可能' : '入力待ち'}</dd></div>
            <div><dt>Compass Quality</dt><dd><strong className={`debug-quality is-${compass.quality.status}`}>{compass.quality.status.toUpperCase()}</strong></dd></div>
          </dl>
        <GeolocationControls state={state} onRequestLocation={requestLocation} />
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
        </section>
        <NorthCorrectionDiagnostics deviceRotation={sensorRotation} compassHeading={sensorOrientation.compassHeading}
          northCorrection={northCorrection} >
          <details className="debug-details"><summary>水平キャリブレーション・北基準の詳細を表示</summary>
            <p className="search-status">スマホを水平に近づけてください。背面カメラを地平線へ向けてください。</p>
            <p className="search-status" role="status">{manualOrientationEnabled ? '手動テストをOFFにしてください'
              : !horizontalCalibration.isHorizontal ? 'もう少し水平にしてください'
                : horizontalCalibration.compassHeading === null ? 'コンパス方位を取得できません' : 'キャリブレーション可能'}</p>
            <button className="find-moon-button" type="button" disabled={!horizontalCalibration.canCalibrate} onClick={handleNorthCalibration}>北基準を合わせる</button>
            <dl className="debug-data">
              <div><dt>水平判定の閾値</dt><dd>{HORIZONTAL_CALIBRATION_THRESHOLD}</dd></div>
              <div><dt>calibrated</dt><dd>{String(calibrated)}</dd></div>
              <div><dt>calibration時刻</dt><dd>{calibratedAt === null ? 'null' : new Date(calibratedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</dd></div>
              <div><dt>北補正の入力元</dt><dd>{transform.correctedRotation ? '保存済み northCorrection' : 'なし'}</dd></div>
            </dl>
            <p className="debug-diagnostic-note">保存値はボタンを押した時点の補正角です。太陽・月の表示とARに共通で適用します。</p>
          </details>
        </NorthCorrectionDiagnostics>
        <CompassStabilityDiagnostics diagnostic={compass} northCorrection={northCorrection}
          rawAccuracy={rawEvent ? rawEvent.webkitCompassAccuracy : null} />
        <SkytreeDebugCard data={landmark} />
        <DiagnosticSnapshots values={{
          latitude: state.status === 'success' ? state.location.latitude : null,
          longitude: state.status === 'success' ? state.location.longitude : null,
          locationTimestamp: state.status === 'success' ? state.location.timestamp : null,
          compassHeading: landmark.compassHeading, compassAccuracy: compass.current?.accuracy ?? null,
          referenceTarget: landmark.referenceTarget, referenceBearing: landmark.referenceBearing,
          compassError: landmark.compassError, correctedHeadingError: landmark.correctedHeadingError,
          webkitCompassAccuracy: landmark.webkitCompassAccuracy, landmarkAccuracy: landmark.landmarkAccuracy,
          distanceToTarget: landmark.distanceToTarget,
          northCorrection, candidateMedian: compass.stats.candidate?.median ?? null,
          candidateRange: compass.stats.candidate?.range ?? null, headingRange: compass.stats.heading?.range ?? null,
          candidateCount: compass.stats.candidate?.count ?? 0, headingCount: compass.stats.heading?.count ?? 0,
          gravityDifference: gravity.angle, correctedHeading: transform.correctedHeading,
          correctedAltitude: transform.cameraForwardCorrected ? cameraVectorToViewAngles(transform.cameraForwardCorrected).altitude : null,
          moonAzimuth: moonPosition?.azimuth ?? null, moonAltitude: moonPosition?.altitude ?? null,
          quality: compass.quality.status, qualityReasons: compass.quality.reasons,
          timeMode, observationTime: observationDate?.toISOString() ?? null,
          orientationSource: manualOrientationEnabled ? 'manual' : 'sensor',
        }} />
        <DeviceDiagnostics orientation={orientation} diagnostics={diagnostics} transform={transform}
          stability={poseStability} manualOrientationEnabled={manualOrientationEnabled} screenAngle={screenAngle}>
          <details className="debug-details"><summary>センサー操作・手動テストを表示</summary>
        <section aria-labelledby="orientation-title">
          <h3 id="orientation-title">端末の向き・センサー操作</h3>
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
          <dl className="debug-data">
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
        </section>
          </details>
        </DeviceDiagnostics>
        <GravityDiagnostics motion={motion} correctedRotation={transform.correctedRotation}
          manualOrientationEnabled={manualOrientationEnabled} orientationActive={sensorOrientation.status === 'active'}
          onEnable={requestMotionPermission} onConventionChange={setGravityConvention} />
        <MoonTransformReadout grouped transform={transform} moonPosition={moonPosition} context={{ observationDate,
          location: state, timeMode, orientationSource: manualOrientationEnabled ? 'manual' : 'sensor',
          orientationStatus: orientation.status, northCorrection: calibrated ? northCorrection : null, poseStability }} />
      </div>
      <details className="debug-details debug-preview-details"><summary>画面投影プレビューを表示</summary>
      <section className="debug-panel" aria-labelledby="preview-title">
        <div className="debug-preview-heading"><h2 id="preview-title">画面投影プレビュー</h2>
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
      </details>
      <section className="debug-panel debug-astronomy" aria-labelledby="astronomy-title">
        <h2 id="astronomy-title"><span>G</span> Astronomy / landmarks</h2>
        <details className="debug-details"><summary>Sun debug を表示</summary>
          <SunDebugCard grouped state={state} correctedHeading={transform.correctedHeading} cameraForwardCorrected={transform.cameraForwardCorrected} />
        </details>
        <details className="debug-details"><summary>月相プレビューを表示</summary><MoonPhasePreview /></details>
      </section>
    </main>
  )
}
