import { useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { GeolocationControls } from '../components/GeolocationControls'
import { useGeolocation } from '../hooks/useGeolocation'
import { useDeviceOrientation } from '../hooks/useDeviceOrientation'
import { getMoonPosition } from '../lib/astronomy'
import { convertMoonToScreen } from '../lib/coordinates'
import type { ScreenPosition } from '../lib/coordinates'
import type { MoonPosition } from '../types/moon'
import { getMoonNavigation } from '../lib/moonNavigation'
import { getDeviceView, normalizeAzimuth } from '../lib/deviceView'
import './HomePage.css'

const DEGREES_PER_PIXEL = 0.2

export function HomePage() {
  const { state, requestLocation } = useGeolocation()
  const { state: orientation, requestPermission: requestOrientationPermission } = useDeviceOrientation()
  const [viewAzimuth, setViewAzimuth] = useState(0)
  const [viewAltitude, setViewAltitude] = useState(0)
  const [sensorMode, setSensorMode] = useState(false)
  const [northOffset, setNorthOffset] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragPosition = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const [observationDate, setObservationDate] = useState<Date | null>(null)
  const [assistedMoonPosition, setAssistedMoonPosition] = useState<MoonPosition | null>(null)
  const moonPosition = useMemo(() => {
    if (state.status !== 'success' || !observationDate) return null

    const { latitude, longitude } = state.location
    return getMoonPosition(latitude, longitude, observationDate)
  }, [state, observationDate])

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
    setObservationDate(new Date())
  }

  return (
    <main
      className={`home-screen${isDragging ? ' is-dragging' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
    >
      <section className="home-content" aria-labelledby="app-title">
        <span className="moon" aria-hidden="true" />
        <h1 id="app-title">moon-walker</h1>
        <p className="home-description">
          今いる場所から月を見つけるWebアプリ。
          <br />
          顔を上げて、月を探してみよう。
        </p>

        <GeolocationControls state={state} onRequestLocation={handleRequestLocation} />
        <p className="search-status">
          マウスでドラッグして見回せます。
        </p>
        {moonPosition && (
          <div className="moon-assist">
            <button className="find-moon-button" type="button" onClick={faceMoon}>
              月を正面にする
            </button>
          </div>
        )}
        <section className="orientation-check" aria-labelledby="orientation-title">
          <h2 id="orientation-title">スマホの向きで月を探す</h2>
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
          {sensorMode && orientation.status !== 'active' && (
            <button className="find-moon-button" type="button" onClick={() => setSensorMode(false)}>
              マウス操作に戻す
            </button>
          )}
          {orientation.status === 'active' && (
            <>
              <button className="find-moon-button" type="button" onClick={() => setSensorMode(!sensorMode)}>
                {sensorMode ? 'マウス操作に戻す' : 'スマホの向きで操作する'}
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
      </section>
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
        <p className={`moon-navigation moon-navigation--${navigation.status}`} role="status" aria-live="polite" aria-atomic="true">
          {navigation.message}
        </p>
      )}
    </main>
  )
}
