import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { GeolocationControls } from '../components/GeolocationControls'
import type { LocationState } from '../types/geolocation'
import { useDeviceOrientation } from '../hooks/useDeviceOrientation'
import { getMoonPosition } from '../lib/astronomy'
import { convertMoonToScreen } from '../lib/coordinates'
import type { ScreenPosition } from '../lib/coordinates'
import type { MoonPosition } from '../types/moon'
import type { Matrix3, Vector3 } from '../types/vector3'
import { getMoonNavigation } from '../lib/moonNavigation'
import { getDeviceView, normalizeAzimuth } from '../lib/deviceView'
import { deviceOrientationToMatrix, moonDirectionToVector, multiplyMatrixVector, transposeMatrix3 } from '../lib/vector3'
import './Page.css'
import './DebugPage.css'

const DEGREES_PER_PIXEL = 0.2
// テスト用の固定日。この日から48時間内で月が最も高い時刻を選ぶ。
const TEST_DATE_START = new Date('2026-10-04T00:00:00+09:00')
const TEST_TIME_STEP_MS = 30 * 60 * 1000

function VectorReadout({ label, vector }: { label: string; vector: Vector3 | null }) {
  return (
    <div className="debug-vector">
      <h3>{label}</h3>
      <dl>{(['x', 'y', 'z'] as const).map((axis) => (
        <div key={axis}><dt>{axis}</dt><dd>{vector?.[axis].toFixed(6) ?? '—'}</dd></div>
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
      ))}</tbody></table> : <p className="search-status">向きの入力待ち</p>}
    </div>
  )
}

export function DebugPage({ state, requestLocation }: { state: LocationState; requestLocation: () => Promise<void> }) {
  const { state: sensorOrientation, requestPermission: requestOrientationPermission } = useDeviceOrientation()
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
  const [northOffset, setNorthOffset] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragPosition = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const observationDate = useMemo(() => {
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
  const [assistedMoonPosition, setAssistedMoonPosition] = useState<MoonPosition | null>(null)
  const moonPosition = useMemo(() => {
    if (state.status !== 'success' || !observationDate) return null

    const { latitude, longitude } = state.location
    return getMoonPosition(latitude, longitude, observationDate)
  }, [state, observationDate])

  const { alpha, beta, gamma } = orientation

  const transform = useMemo(() => {
    const moonWorld = moonPosition ? moonDirectionToVector(moonPosition.azimuth, moonPosition.altitude) : null
    const deviceRotation = alpha !== null && beta !== null && gamma !== null
      ? deviceOrientationToMatrix(alpha, beta, gamma) : null
    const inverseRotation = deviceRotation ? transposeMatrix3(deviceRotation) : null
    const moonInDevice = inverseRotation && moonWorld ? multiplyMatrixVector(inverseRotation, moonWorld) : null
    return { moonWorld, deviceRotation, inverseRotation, moonInDevice }
  }, [moonPosition, alpha, beta, gamma])

  useEffect(() => {
    if (transform.moonInDevice) console.log('moonInDevice', transform.moonInDevice)
  }, [transform])

  // 新しい月位置を取得したときだけ視点を合わせ、その後のドラッグは維持する。
  if (moonPosition && moonPosition !== assistedMoonPosition) {
    setAssistedMoonPosition(moonPosition)
    setViewAzimuth(moonPosition.azimuth)
    setViewAltitude(moonPosition.altitude)
  }

  const deviceView = orientation.status === 'active' ? getDeviceView(orientation) : null
  const hasCompass = orientation.absolute || orientation.compassHeading !== null
  const sensorView = deviceView && (hasCompass || northOffset !== null)
    ? { ...deviceView, azimuth: normalizeAzimuth(deviceView.azimuth + (hasCompass ? 0 : northOffset ?? 0)) }
    : null
  const currentView = sensorMode ? sensorView : { azimuth: viewAzimuth, altitude: viewAltitude }
  const screenPosition: ScreenPosition | null = moonPosition && currentView
    ? convertMoonToScreen(moonPosition.azimuth, moonPosition.altitude, currentView.azimuth, currentView.altitude)
    : null
  const navigation = moonPosition && currentView
    ? getMoonNavigation(moonPosition, currentView)
    : null

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
    <main className="debug-screen">
      <header className="debug-header">
        <div><p className="debug-eyebrow">MOON-WALKER / DEBUG</p>
          <h1>座標変換デバッグ</h1>
          <p className="search-status">位置情報 → 月の世界座標 → 端末座標の変換を確認します。</p>
        </div>
        <span className={`debug-status${transform.moonInDevice ? ' is-ready' : ''}`}>
          {transform.moonInDevice ? '計算中' : '入力待ち'}
        </span>
      </header>
      <div className="debug-grid">
        <section className="debug-panel" aria-labelledby="location-title">
          <h2 id="location-title"><span>01</span> 現在地と月</h2>
        <GeolocationControls state={state} onRequestLocation={handleRequestLocation} />
        {observationDate && (
          <p className="search-status">
            テスト日時（固定）: {observationDate.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}（日本時間）
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
              <p className="search-status">現在地を取得すると、向きの変更に合わせてコンソールにmoonInDeviceを出力します。</p>
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
                  <button className="find-moon-button" type="button" disabled={!deviceView} onClick={() => {
                    if (deviceView) setNorthOffset(-deviceView.azimuth)
                  }}>
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
            alpha: {orientation.alpha?.toFixed(1) ?? '—'}°
            <br />
            beta: {orientation.beta?.toFixed(1) ?? '—'}°
            <br />
            gamma: {orientation.gamma?.toFixed(1) ?? '—'}°
          </p>
        </section>
        <section className="debug-panel debug-results" aria-labelledby="results-title">
          <h2 id="results-title"><span>03</span> 3D変換結果</h2>
          <p className="search-status">world → transpose(rotation) → device</p>
          <VectorReadout label="moonWorld / ENU" vector={transform.moonWorld} />
          <VectorReadout label="moonInDevice" vector={transform.moonInDevice} />
          <p className="search-status">端末: +x 右 / +y 上 / −z 背面カメラ正面。真正面の目安は (0, 0, −1)。</p>
          <p className="search-status">{!moonPosition ? '現在地を取得してください。' : !transform.moonInDevice ? '手動テストをONにするか、センサーを有効にしてください。' : `ベクトル長: ${Math.hypot(transform.moonInDevice.x, transform.moonInDevice.y, transform.moonInDevice.z).toFixed(6)}`}</p>
          <MatrixReadout label="deviceRotation" matrix={transform.deviceRotation} />
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
