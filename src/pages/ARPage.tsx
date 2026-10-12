import { useEffect, useMemo, useState } from 'react'
import { AppLink } from '../components/AppNavigation'
import type { useGeolocation } from '../hooks/useGeolocation'
import { useDeviceOrientation } from '../hooks/useDeviceOrientation'
import { useNorthCalibration } from '../hooks/useNorthCalibration'
import { getMoonPosition } from '../lib/astronomy'
import { getObservationTime } from '../lib/observationTime'
import { getMoonDeviceState, getMoonDeviceDiagnosticAttributes } from '../lib/moonDeviceNavigation'
import type { Navigate } from '../components/AppNavigation'
import './Frontend.css'
import '../styles/ar/ar-page.css'

import { SkyBackground } from '../components/ar/SkyBackground'
import { MoonSprite } from '../components/ar/MoonSprite'
import { useSkyParallax } from '../hooks/useSkyParallax'
import {
  getCameraForward,
  cameraVectorToViewAngles,
} from '../lib/skyParallax'

import { projectMoonToScreen } from '../lib/moonProjection'

export function ARPage({ navigate, state: location, requestLocation }: { navigate: Navigate } & ReturnType<typeof useGeolocation>) {
  const { northCorrection, calibrated } = useNorthCalibration()
  const { state: orientation, requestPermission } = useDeviceOrientation({ autoStart: true })
  const [now, setNow] = useState(getObservationTime)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(getObservationTime()), 10000)
    return () => window.clearInterval(timer)
  }, [])
  const moonPosition = useMemo(() => location.status === 'success'
    ? getMoonPosition(location.location.latitude, location.location.longitude, now) : null, [location, now])
  const ready = calibrated && northCorrection !== null && Number.isFinite(northCorrection)
  const isBelowHorizon = moonPosition !== null && !moonPosition.isAboveHorizon
  const deviceState = getMoonDeviceState(orientation, ready ? northCorrection : null, moonPosition, orientation.compassHeading)

  const cameraForward =
    deviceState.correctedRotation
      ? getCameraForward(
        deviceState.correctedRotation
      )
      : null

  const viewAngles =
    cameraForward
      ? cameraVectorToViewAngles(cameraForward)
      : null
  const guidance = !isBelowHorizon ? deviceState.navigation : null
  const isNear = guidance !== null && guidance.angleToMoon <= 15
  const isCentered = guidance?.status === 'centered'
  const parallax = useSkyParallax({
    heading: viewAngles?.heading ?? null,
    altitude: viewAngles?.altitude ?? null,
  })

  const moonScreen = deviceState.moonInDevice
    ? projectMoonToScreen(deviceState.moonInDevice)
    : null

  return (
    <SkyBackground
      offsetX={parallax.offsetX}
      offsetY={parallax.offsetY}
    >
      <main className="mw-screen mw-ar" aria-label="月を探す" {...getMoonDeviceDiagnosticAttributes(deviceState, now)}>
        <header className="mw-top">
          <AppLink
            to="/"
            navigate={navigate}
            className="mw-ar-close"
          >
            <span aria-hidden="true">×</span>
            <span className="mw-sr-only">ホームへ戻る</span>
          </AppLink>

          <div className="mw-ar-title">
            <span className="mw-ar-eyebrow">MOON WALKER</span>
            <h1>月を探す</h1>
          </div>

          <AppLink
            to="/moon-info"
            navigate={navigate}
            className="mw-ar-info"
          >
            月の情報
          </AppLink>
        </header>

        <div className="mw-ar-viewport" aria-hidden="true">
          {guidance && moonScreen && (
            <MoonSprite x={moonScreen.x} y={moonScreen.y} visible={moonScreen.visible} />
          )}
          {isNear && (
            <div
              className={[
                'mw-ar-ring',
                isCentered ? 'mw-ar-ring--centered' : 'mw-ar-ring--near',
              ].join(' ')}
            />
          )}
        </div>

        {guidance && (
          <section className={`mw-ar-guide${isCentered ? ' is-centered' : ''}`} aria-label="月への案内">
            <p className="mw-ar-guide-label">{isCentered ? '月の方向に向いています' : 'スマホをゆっくり動かして'}</p>
            <div className="mw-ar-guidance-row">
              <span className="mw-ar-arrow" aria-hidden="true">
                {guidance.arrow}
              </span>
              <p className="mw-ar-message" role="status" aria-live="polite" aria-atomic="true">
                {guidance.message}
              </p>
            </div>
            <div className="mw-ar-guide-footer">
              <span className="mw-ar-distance">
                月まで
                <strong>
                  {guidance.angleToMoon.toFixed(1)}°
                </strong>
              </span>
              <AppLink to="/calibration" navigate={navigate} className="mw-ar-recalibrate">向きを調整</AppLink>
            </div>
          </section>
        )}

        {isBelowHorizon && (
          <section className="mw-ar-state mw-ar-below-horizon" role="status" aria-labelledby="below-horizon-title">
            <h1 id="below-horizon-title">月は地平線の<br />下にあります</h1>
            <p>今は空に月を見ることができません。</p>
            <AppLink to="/moon-info" navigate={navigate} className="mw-primary">月の情報を見る</AppLink>
          </section>
        )}

        {!isBelowHorizon && ready && location.status === 'success' && !guidance && (
          <div className="mw-ar-state">
            <h2>スマホの向きを確認</h2>
            <p role="status">{orientation.message}</p>
            {['idle', 'denied', 'error'].includes(orientation.status) && (
              <button type="button" className="mw-primary" onClick={() => void requestPermission()}>
                向きセンサーを許可する
              </button>
            )}
          </div>
        )}

        {!isBelowHorizon && !ready && (
          <div className="mw-ar-state">
            <h2>まずは向きを合わせましょう</h2>
            <p>月を探す準備ができていません</p>
            <AppLink
              to="/calibration"
              navigate={navigate}
              className="mw-primary"
            >
              準備する
            </AppLink>
          </div>
        )}

        {ready && location.status !== 'success' && (
          <div className="mw-ar-state">
            <h2>観測する場所を確認</h2>
            <p>現在地が必要です</p>
            <button
              type="button"
              className="mw-primary"
              onClick={() => void requestLocation()}
            >
              現在地を取得
            </button>
          </div>
        )}

      </main>
    </SkyBackground>
  )
}
