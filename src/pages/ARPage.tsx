import { useEffect, useMemo, useState } from 'react'
import { AppLink } from '../components/AppNavigation'
import type { useGeolocation } from '../hooks/useGeolocation'
import { useDeviceOrientation } from '../hooks/useDeviceOrientation'
import { useNorthCalibration } from '../hooks/useNorthCalibration'
import { getMoonPosition } from '../lib/astronomy'
import { deviceOrientationToMatrix } from '../lib/vector3'
import { getMoonInDevice, getMoonDeviceNavigation } from '../lib/moonDeviceNavigation'
import type { Navigate } from '../components/AppNavigation'
import './Frontend.css'

export function ARPage({ navigate, state: location, requestLocation }: { navigate: Navigate } & ReturnType<typeof useGeolocation>) {
  const { northCorrection, calibrated } = useNorthCalibration()
  const { state: orientation, requestPermission } = useDeviceOrientation()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 10000)
    return () => window.clearInterval(timer)
  }, [])
  const moonPosition = useMemo(() => location.status === 'success'
    ? getMoonPosition(location.location.latitude, location.location.longitude, now) : null, [location, now])
  const ready = calibrated && northCorrection !== null && Number.isFinite(northCorrection)
  const { alpha, beta, gamma } = orientation
  const moonInDevice = ready && moonPosition && alpha !== null && beta !== null && gamma !== null
    && [alpha, beta, gamma].every(Number.isFinite)
    ? getMoonInDevice(moonPosition, deviceOrientationToMatrix(alpha, beta, gamma), northCorrection) : null
  const guidance = moonInDevice ? getMoonDeviceNavigation(moonInDevice) : null
  const message = !ready ? '北基準の準備が必要です'
    : location.status !== 'success' ? '現在地を取得してください'
      : guidance?.message ?? '向きセンサーの準備が必要です'
  const isNear = guidance && guidance.angleToMoon <= 15
  const isCentered = guidance?.status === 'centered'
  return (
    <main className="mw-screen mw-ar" aria-label="月を探す">
      <header className="mw-top">
        <AppLink
          to="/"
          navigate={navigate}
          className="mw-ar-close"
        >
          <span aria-hidden="true">×</span>
          <span className="mw-sr-only">ホームへ戻る</span>
        </AppLink>

        <AppLink
          to="/moon-info"
          navigate={navigate}
          className="mw-ar-info"
        >
          月の情報
        </AppLink>
      </header>

      <div className="mw-ar-guide">
        {guidance && (
          <>
            <span className="mw-ar-arrow" aria-hidden="true">
              {guidance.arrow}
            </span>

            <p className="mw-ar-message" role="status">
              {guidance.message}
            </p>

            {isNear && (
              <div
                className={[
                  'mw-ar-ring',
                  isCentered ? 'mw-ar-ring--centered' : 'mw-ar-ring--near',
                ].join(' ')}
                aria-hidden="true"
              />
            )}

            <span className="mw-ar-distance">
              月まで
              <strong>
                {guidance.angleToMoon.toFixed(1)}°
              </strong>
            </span>
          </>
        )}
      </div>

      {!ready && (
        <div className="mw-ar-state">
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

      {guidance &&
        moonPosition &&
        !moonPosition.isAboveHorizon && (
          <div className="mw-ar-state">
            <p>現在、月は地平線の下にあります</p>
          </div>
        )}
    </main>
  )
}
