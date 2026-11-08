import { useEffect } from 'react'
import type { Navigate } from '../../app/navigation/AppNavigation'
import { useDeviceOrientation } from '../../features/device-orientation/useDeviceOrientation'
import { useNorthCalibration } from '../../features/north-calibration/useNorthCalibration'
import { useNorthCalibrationSampling } from '../../features/north-calibration/useNorthCalibrationSampling'
import { useCurrentObservationTime } from '../../shared/time/useCurrentObservationTime'

import '../../shared/styles/frontend.css'
import './CalibrationPage.css'

export const CALIBRATION_COMPLETE_DISPLAY_MS = 600

export function CalibrationPage({ navigate }: { navigate: Navigate }) {
  const { state, requestPermission, retryConnection, diagnostics } = useDeviceOrientation()
  const { saveNorthCalibration } = useNorthCalibration()
  const { now: currentTime } = useCurrentObservationTime(true, 1000)
  const { measurement, isCurrentCompletion } = useNorthCalibrationSampling(
    diagnostics.lastAccepted, state.status === 'active', saveNorthCalibration,
  )
  const complete = measurement.phase === 'complete'
  const requiresPermission = typeof window !== 'undefined'
    && typeof (window.DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: unknown } | undefined)?.requestPermission === 'function'
  useEffect(() => {
    if (!requiresPermission && state.status === 'idle') void requestPermission()
  }, [requiresPermission, state.status, requestPermission])

  useEffect(() => {
    if (!complete) return
    const timer = window.setTimeout(() => {
      if (isCurrentCompletion() && document.visibilityState !== 'hidden') navigate('/ar')
    }, CALIBRATION_COMPLETE_DISPLAY_MS)
    return () => window.clearTimeout(timer)
  }, [complete, navigate, isCurrentCompletion])

  return <main className={`mw-screen mw-calibration${complete ? ' is-complete' : ''}`}>
    <section className="mw-calibration-content" aria-labelledby="calibration-title">
      <p className="mw-calibration-current-time">現在時刻<br /><time dateTime={currentTime.toISOString()}>{currentTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZoneName: 'short' })}</time></p>
      <div className="mw-calibration-visual">
        <img className="mw-calibration-guide" src="/calibration-guide.png" alt="スマホをまっすぐ前に向けるイメージ" />
        <p className="mw-calibration-image-caption">スマホをまっすぐ前に向けてください</p>
      </div>
      <h1 id="calibration-title" className="mw-sr-only">向きセンサー</h1>
      <div className="mw-ar-controls mw-calibration-sensor">
        {!complete && state.status === 'unavailable' && <button type="button" className="mw-primary" onClick={retryConnection}>向きセンサーに再接続する</button>}
        {!complete && ['idle', 'denied', 'error'].includes(state.status) && <button type="button" className="mw-primary" onClick={() => void requestPermission()}>向きセンサーを許可する</button>}
        <p role="status"><span className="mw-calibration-status-dot" aria-hidden="true" />{state.status === 'active' ? measurement.message : state.message || '向きセンサーを取得中です'}</p>
        {state.status === 'active' && <progress className="mw-calibration-progress" aria-label="向きの測定" max={1} value={measurement.progress} />}
      </div>
    </section>
  </main>
}
