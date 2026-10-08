import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { GeolocationControls } from '../components/GeolocationControls'
import type { LocationState } from '../types/geolocation'
import { useDeviceOrientation } from '../hooks/useDeviceOrientation'
import { getMoonPosition } from '../lib/astronomy'
import { convertMoonToScreen } from '../lib/coordinates'
import type { ScreenPosition } from '../lib/coordinates'
import type { Matrix3, Vector3 } from '../types/vector3'
import { getMoonNavigation } from '../lib/moonNavigation'
import { getMoonDeviceState, getMoonDeviceDiagnosticAttributes } from '../lib/moonDeviceNavigation'
import { captureNorthCalibration, getHorizontalCalibration, HORIZONTAL_CALIBRATION_THRESHOLD } from '../lib/horizontalCalibration'
import { useNorthCalibration } from '../hooks/useNorthCalibration'
import { SunDebugCard } from '../debug/solar/SunDebugCard'
import './Page.css'
import './DebugPage.css'

const DEGREES_PER_PIXEL = 0.2
// テスト用の固定日。この日から48時間内で月が最も高い時刻を選ぶ。
const TEST_DATE_START = new Date('2026-10-04T00:00:00+09:00')
const TEST_TIME_STEP_MS = 30 * 60 * 1000

function diagnosticValue(value: number | boolean | null | undefined): string {
  if (value === undefined) return 'unavailable'
  if (value === null) return 'null'
  if (typeof value === 'boolean') return String(value)
  return Number.isFinite(value) ? value.toFixed(4) : 'unavailable (non-finite)'
}

function eventTime(value: number | undefined): string {
  return value === undefined ? 'null (未受信)' : new Date(value).toLocaleTimeString('ja-JP', { hour12: false }) + `.${String(value % 1000).padStart(3, '0')} (端末時刻)`
}

function VectorReadout({ label, vector }: { label: string; vector: Vector3 | null }) {
  return (
    <div className="debug-vector">
      <h3>{label}</h3>
      <dl>{(['x', 'y', 'z'] as const).map((axis) => (
        <div key={axis}><dt>{axis}</dt><dd>{diagnosticValue(vector ? vector[axis] : null)}</dd></div>
      ))}</dl>
    </div>
  )
}

function MatrixReadout({ label, matrix }: { label: string; matrix: Matrix3 | null }) {
  return (
    <div className="debug-matrix">
      <h3>{label}</h3>
      {matrix ? <table aria-label={label}><tbody>{matrix.map((row, index) => (
        <tr key={index}>{row.map((value, column) => <td key={column}>{value.toFixed(4)}</td>)}</tr>
      ))}</tbody></table> : <p className="search-status">null (向きの入力待ち)</p>}
    </div>
  )
}

export function DebugPage({ state, requestLocation }: { state: LocationState; requestLocation: () => Promise<void> }) {
  const { state: sensorOrientation, requestPermission: requestOrientationPermission, diagnostics } = useDeviceOrientation()
  const [screenAngle, setScreenAngle] = useState<number | undefined>(() => window.screen.orientation?.angle)

  useEffect(() => {
    const screenOrientation = window.screen.orientation
    const updateScreenAngle = () => setScreenAngle(window.screen.orientation?.angle)
    screenOrientation?.addEventListener('change', updateScreenAngle)
    window.addEventListener('orientationchange', updateScreenAngle)
    return () => {
      screenOrientation?.removeEventListener('change', updateScreenAngle)
      window.removeEventListener('orientationchange', updateScreenAngle)
    }
  }, [])
  const [manualOrientationEnabled, setManualOrientationEnabled] = useState(false)
  const [manualOrientation, setManualOrientation] = useState({ alpha: 0, beta: 90, gamma: 0 })
  const orientation = manualOrientationEnabled
    ? {
      ...sensorOrientation,
      ...manualOrientation,
      status: 'active' as const,
      absolute: true,
      compassHeading: null,
      message: 'PCテスト中です。スライダーで端末の向きを変更できます。',
    }
    : sensorOrientation
  const [viewAzimuth, setViewAzimuth] = useState(0)
  const [viewAltitude, setViewAltitude] = useState(0)
  const [sensorMode, setSensorMode] = useState(false)
  const { northCorrection, calibrated, calibratedAt, saveNorthCalibration } = useNorthCalibration()
  const [isDragging, setIsDragging] = useState(false)
  const dragPosition = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const [timeMode, setTimeMode] = useState<'fixed' | 'current'>('fixed')
  const [currentDate, setCurrentDate] = useState(() => new Date())

  useEffect(() => {
    if (timeMode !== 'current') return
    const updateTime = () => setCurrentDate(new Date())
    const timer = window.setInterval(updateTime, 1000)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') updateTime()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [timeMode])

  const fixedObservationDate = useMemo(() => {
    if (state.status !== 'success') return null

    const { latitude, longitude } = state.location
    let bestDate = TEST_DATE_START
    let highestAltitude = -Infinity
    for (let step = 0; step < 96; step += 1) {
      const date = new Date(TEST_DATE_START.getTime() + step * TEST_TIME_STEP_MS)
      const { altitude } = getMoonPosition(latitude, longitude, date)
      if (altitude > highestAltitude) {
        highestAltitude = altitude
        bestDate = date
      }
    }
    return bestDate
  }, [state])
  const observationDate = timeMode === 'current' ? currentDate : fixedObservationDate
  const [assistedInput, setAssistedInput] = useState<{ state: LocationState; timeMode: typeof timeMode } | null>(null)
  const moonPosition = useMemo(() => {
    if (state.status !== 'success' || !observationDate) return null

    const { latitude, longitude } = state.location
    return getMoonPosition(latitude, longitude, observationDate)
  }, [state, observationDate])

  const transform = getMoonDeviceState(
    orientation, calibrated ? northCorrection : null, moonPosition, orientation.compassHeading,
  )

  // 位置取得・時刻モード変更時だけ視点を合わせ、自動更新中のドラッグは維持する。
  if (moonPosition && (state !== assistedInput?.state || timeMode !== assistedInput?.timeMode)) {
    setAssistedInput({ state, timeMode })
    setViewAzimuth(moonPosition.azimuth)
    setViewAltitude(moonPosition.altitude)
  }

  const hasCompass = !manualOrientationEnabled && (orientation.absolute || orientation.compassHeading !== null)
  const sensorView = transform.correctedView
  const currentView = sensorMode ? sensorView : { azimuth: viewAzimuth, altitude: viewAltitude }
  const screenPosition: ScreenPosition | null = moonPosition && currentView
    ? convertMoonToScreen(moonPosition.azimuth, moonPosition.altitude, currentView.azimuth, currentView.altitude)
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

  function faceMoon(): void {
    if (!moonPosition) return

    setSensorMode(false)
    setViewAzimuth(moonPosition.azimuth)
    setViewAltitude(moonPosition.altitude)
  }

  function moveView(azimuthDelta: number, altitudeDelta: number): void {
    setViewAzimuth((azimuth) => ((azimuth + azimuthDelta) % 360 + 360) % 360)
    setViewAltitude((altitude) => Math.max(-90, Math.min(90, altitude + altitudeDelta)))
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>): void {
    if (sensorMode) return
    if (event.pointerType !== 'mouse' || event.button !== 0 || dragPosition.current) return
    if (event.target instanceof Element && event.target.closest('button, summary, a, input, select, textarea')) return

    event.currentTarget.setPointerCapture(event.pointerId)
    dragPosition.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    setIsDragging(true)
    event.preventDefault()
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>): void {
    const previous = dragPosition.current
    if (!previous || previous.pointerId !== event.pointerId) return

    const deltaX = event.clientX - previous.x
    const deltaY = event.clientY - previous.y
    dragPosition.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    moveView(deltaX * DEGREES_PER_PIXEL, -deltaY * DEGREES_PER_PIXEL)
  }

  function handlePointerEnd(event: PointerEvent<HTMLElement>): void {
    if (dragPosition.current?.pointerId !== event.pointerId) return

    dragPosition.current = null
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  async function handleRequestLocation(): Promise<void> {
    await requestLocation()
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
        <GeolocationControls state={state} onRequestLocation={handleRequestLocation} />
          <label className="debug-time-mode">
            月の位置を計算する時刻
            <select value={timeMode} onChange={(event) => {
              const mode = event.target.value === 'current' ? 'current' : 'fixed'
              if (mode === 'current') setCurrentDate(new Date())
              setTimeMode(mode)
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
        <section className="debug-panel" aria-labelledby="raw-title">
          <h2 id="raw-title">raw sensor</h2>
          <p className="search-status">既存フックが採用したイベントの生データ。手動入力で上書きしません。</p>
          <dl className="debug-data">
            <div><dt>raw alpha (°)</dt><dd>{diagnosticValue(rawEvent?.alpha ?? null)}</dd></div>
            <div><dt>raw beta (°)</dt><dd>{diagnosticValue(rawEvent?.beta ?? null)}</dd></div>
            <div><dt>raw gamma (°)</dt><dd>{diagnosticValue(rawEvent?.gamma ?? null)}</dd></div>
            <div><dt>absolute</dt><dd>{diagnosticValue(rawEvent?.absolute ?? null)}</dd></div>
            <div><dt>使用中のイベント種別</dt><dd>{rawEvent?.eventType ?? 'null (未受信)'}</dd></div>
            <div><dt>最終採用イベント受信時刻</dt><dd>{eventTime(rawEvent?.receivedAt)}</dd></div>
            <div><dt>最終イベント受信時刻</dt><dd>{eventTime(diagnostics.lastReceived?.receivedAt)}</dd></div>
            <div><dt>最終受信イベント種別</dt><dd>{diagnostics.lastReceived?.eventType ?? 'null (未受信)'}</dd></div>
            <div><dt>最終受信イベントの採用</dt><dd>{diagnostics.lastReceived ? diagnostics.lastReceived === rawEvent ? '採用' : '既存条件により無視' : 'null (未受信)'}</dd></div>
            <div><dt>screen.orientation.angle (°)</dt><dd>{diagnosticValue(screenAngle)}</dd></div>
          </dl>
          {manualOrientationEnabled && <p className="debug-diagnostic-note">手動テストON: 以下のcameraForwardとmoon transformは手動入力から計算しています。</p>}
        </section>
        <section className="debug-panel" aria-labelledby="calibration-title">
          <h2 id="calibration-title">水平キャリブレーション</h2>
          <p className="search-status">スマホを水平に近づけてください。背面カメラを地平線へ向けてください。</p>
          <p className="search-status" role="status">
            {manualOrientationEnabled ? '手動テストをOFFにしてください'
              : !horizontalCalibration.isHorizontal ? 'もう少し水平にしてください'
                : horizontalCalibration.compassHeading === null ? 'コンパス方位を取得できません'
                  : 'キャリブレーション可能'}
          </p>
          <button className="find-moon-button" type="button" disabled={!horizontalCalibration.canCalibrate}
            onClick={handleNorthCalibration}>
            北基準を合わせる
          </button>
          <VectorReadout label="cameraForwardRaw" vector={horizontalCalibration.cameraForwardRaw} />
          <dl className="debug-data">
            <div><dt>horizontalLength</dt><dd>{diagnosticValue(horizontalCalibration.horizontalLength)}</dd></div>
            <div><dt>水平判定の閾値</dt><dd>{HORIZONTAL_CALIBRATION_THRESHOLD}</dd></div>
            <div><dt>rawHeading (°)</dt><dd>{diagnosticValue(horizontalCalibration.rawHeading)}</dd></div>
            <div><dt>webkitCompassHeading (°)</dt><dd>{diagnosticValue(horizontalCalibration.compassHeading)}</dd></div>
            <div><dt>northCorrection 候補 (°)</dt><dd>{diagnosticValue(horizontalCalibration.northCorrection)}</dd></div>
            <div><dt>northCorrection 保存値 (°)</dt><dd>{diagnosticValue(northCorrection)}</dd></div>
            <div><dt>calibrated</dt><dd>{String(calibrated)}</dd></div>
            <div><dt>calibration時刻</dt><dd>{calibratedAt !== null
              ? new Date(calibratedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : 'null'}</dd></div>
          </dl>
          <p className="debug-diagnostic-note">保存値はボタンを押した時点の補正角です。太陽・月の表示とARに共通で適用します。</p>
        </section>
        <section className="debug-panel" aria-labelledby="compass-title">
          <h2 id="compass-title">compass</h2>
          <dl className="debug-data">
            <div><dt>webkitCompassHeading (°)</dt><dd>{rawEvent ? diagnosticValue(rawEvent.webkitCompassHeading) : 'null (未受信)'}</dd></div>
            <div><dt>webkitCompassAccuracy (°)</dt><dd>{rawEvent ? diagnosticValue(rawEvent.webkitCompassAccuracy) : 'null (未受信)'}</dd></div>
            <div><dt>採用されたheading (°)</dt><dd>{diagnosticValue(sensorOrientation.compassHeading)}</dd></div>
            <div><dt>適用した北補正角 (°、世界Z軸まわりの回転)</dt><dd>{diagnosticValue(transform.correctedRotation ? northCorrection : null)}</dd></div>
            <div><dt>北補正の入力元</dt><dd>{transform.correctedRotation ? '保存済み northCorrection' : 'なし'}</dd></div>
          </dl>
          <p className="debug-diagnostic-note">コンパスは保存時の基準と誤差確認に使います。表示時は保存済みnorthCorrectionだけを適用します。</p>
          {rawEvent?.webkitCompassAccuracy !== undefined && rawEvent.webkitCompassAccuracy < 0 && (
            <p className="debug-diagnostic-note">コンパス精度が負の値です。既存の採用条件は変更せず、そのまま表示しています。</p>
          )}
        </section>
        <section className="debug-panel" aria-labelledby="before-title">
          <h2 id="before-title">cameraForward before correction</h2>
          <p className="search-status">deviceRotation × (0, 0, −1)。absolute=falseの場合は任意の基準座標で、ENUへの北合わせは未適用です。</p>
          <VectorReadout label="cameraForward / ENU軸表記・補正前" vector={transform.cameraForwardRaw} />
          <dl className="debug-data">
            <div><dt>azimuth (°)</dt><dd>{diagnosticValue(transform.rawView?.azimuth ?? null)}</dd></div>
            <div><dt>altitude (°)</dt><dd>{diagnosticValue(transform.rawView?.altitude ?? null)}</dd></div>
          </dl>
        </section>
        <section className="debug-panel" aria-labelledby="after-title">
          <h2 id="after-title">cameraForward after correction</h2>
          <p className="search-status">共通ロジックのcorrectedRotation × (0, 0, −1)。太陽プレビュー・月の変換・ARで同じ回転行列を使います。</p>
          <VectorReadout label="cameraForward / ENU・補正後" vector={transform.cameraForwardCorrected} />
          <dl className="debug-data">
            <div><dt>azimuth (°)</dt><dd>{diagnosticValue(transform.correctedView?.azimuth ?? null)}</dd></div>
            <div><dt>altitude (°)</dt><dd>{diagnosticValue(transform.correctedView?.altitude ?? null)}</dd></div>
          </dl>
          {!transform.cameraForwardCorrected && <p className="search-status">null: 向きの未取得、方位の未確定、または北基準なし。</p>}
        </section>
        <section className="debug-panel" aria-labelledby="after-calibration-title">
          <h2 id="after-calibration-title">cameraForward after calibration</h2>
          <p className="search-status">保存したnorthCorrectionで Rz(northCorrection) × deviceRotation を計算する診断表示です。</p>
          <VectorReadout label="cameraForwardCorrected / ENU" vector={transform.cameraForwardCorrected} />
          <dl className="debug-data">
            <div><dt>correctedHeading (°)</dt><dd>{diagnosticValue(transform.correctedHeading)}</dd></div>
            <div><dt>webkitCompassHeading (°)</dt><dd>{diagnosticValue(horizontalCalibration.compassHeading)}</dd></div>
            <div><dt>headingError (°)</dt><dd>{diagnosticValue(transform.headingError)}</dd></div>
          </dl>
          <p className="debug-diagnostic-note">headingError = correctedHeading − webkitCompassHeading（最短角度差）。未保存・姿勢未取得・コンパス未取得ではnullです。カメラが真上・真下の場合も方位はnullです。</p>
        </section>
        <SunDebugCard state={state} correctedHeading={transform.correctedHeading} cameraForwardCorrected={transform.cameraForwardCorrected} />
        <section className="debug-panel debug-results" aria-labelledby="results-title">
          <h2 id="results-title">moon transform</h2>
          <p className="search-status">world → transpose(correctedRotation) → device</p>
          <VectorReadout label="moonWorld / ENU" vector={transform.moonWorld} />
          <VectorReadout label="moonInDevice" vector={transform.moonInDevice} />
          <p className="search-status">端末: +x 右 / +y 上 / −z 背面カメラ正面。真正面の目安は (0, 0, −1)。</p>
          <dl className="debug-data"><div><dt>moonInDeviceのベクトル長</dt><dd>{diagnosticValue(transform.moonVectorLength)}</dd></div></dl>
          <p className="search-status">太陽で確認した北補正を使う共通3D変換。{!moonPosition ? '現在地を取得してください。' : !transform.moonInDevice ? '北補正を保存し、センサーを有効にしてください。' : 'センサー値の更新に合わせて計算しています。'}</p>
          <dl className="debug-data"><div><dt>angleToMoon (°)</dt><dd>{diagnosticValue(transform.angleToMoon)}</dd></div></dl>
          <MatrixReadout label="deviceRotation" matrix={transform.deviceRotation} />
          <MatrixReadout label="correctedRotation" matrix={transform.correctedRotation} />
          <MatrixReadout label="inverseRotation" matrix={transform.inverseRotation} />
        </section>
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
    </main>
  )
}
