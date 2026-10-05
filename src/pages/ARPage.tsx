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
  return <main className="mw-screen mw-ar" aria-label="月を探すプレビュー">
    <header className="mw-top"><AppLink to="/" navigate={navigate} className="mw-ar-close"><span aria-hidden="true">×</span><span className="mw-sr-only">ホームへ戻る</span></AppLink><span className="mw-kicker">AR PREVIEW</span><AppLink to="/moon-info" navigate={navigate} className="mw-ar-info">月の情報</AppLink></header>
    {guidance?.status === 'centered' && <div className="mw-ar-target" aria-hidden="true"><span className="mw-target-dot" /><span className="mw-target-line" /></div>}
    <div className="mw-ar-guidance">
      <span className="mw-ar-arrow" aria-hidden="true">{guidance?.arrow}</span><p role="status">{message}</p>
      <span className="mw-ar-distance">月まで <strong>{guidance ? `${guidance.angleToMoon.toFixed(1)}°` : '—'}</strong></span>
      {!ready && <AppLink to="/calibration" navigate={navigate} className="mw-secondary">北基準の準備へ →</AppLink>}
      {ready && <div className="mw-ar-controls">
        <button type="button" className="mw-primary" disabled={location.status === 'loading'} onClick={() => void requestLocation()}>{location.status === 'loading' ? '現在地を取得中…' : '現在地を取得'}</button>
        {location.status === 'error' && <p>{location.message}</p>}
        <button type="button" className="mw-secondary" disabled={['requesting', 'waiting', 'active'].includes(orientation.status)} onClick={() => void requestPermission()}>向きセンサーを有効にする</button>
        {!guidance && <p>{orientation.message}</p>}
      </div>}
      {guidance && moonPosition && !moonPosition.isAboveHorizon && <p>現在、月は地平線の下にあります</p>}
      {import.meta.env.DEV && moonInDevice && <small className="mw-ar-vector">moonInDevice: x={moonInDevice.x.toFixed(3)} / y={moonInDevice.y.toFixed(3)} / z={moonInDevice.z.toFixed(3)}</small>}
    </div>
    <p className="mw-ar-footnote">端末の背面を月の方向へ向けてください</p>
  </main>
}
