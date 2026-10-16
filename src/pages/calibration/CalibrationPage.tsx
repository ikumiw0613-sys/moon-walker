import { useEffect, useRef, useState } from 'react'
import { AppLink } from '../../app/navigation/AppNavigation'
import type { Navigate } from '../../app/navigation/AppNavigation'
import { useDeviceOrientation } from '../../features/device-orientation/useDeviceOrientation'
import { useNorthCalibration } from '../../features/north-calibration/useNorthCalibration'
import { getHorizontalCalibration, captureNorthCalibration } from '../../features/north-calibration/horizontalCalibration'
import { useCurrentObservationTime } from '../../shared/time/useCurrentObservationTime'

import '../../shared/styles/frontend.css'
import './CalibrationPage.css'

export const CALIBRATION_HOLD_MS = 700
export const CALIBRATION_COMPLETE_DISPLAY_MS = 600
const MAX_SAMPLE_GAP_MS = 250

export function CalibrationPage({ navigate }: { navigate: Navigate }) {
  const { state, requestPermission, retryConnection } = useDeviceOrientation()
  const { saveNorthCalibration } = useNorthCalibration()
  const { now: currentTime } = useCurrentObservationTime(true, 1000)
  const [complete, setComplete] = useState(false)
  const saved = useRef(false)
  const hold = useRef<{ startedAt: number; lastSampleAt: number } | null>(null)
  const requiresPermission = typeof window !== 'undefined'
    && typeof (window.DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: unknown } | undefined)?.requestPermission === 'function'
  useEffect(() => {
    const reset = () => {
      saved.current = false
      hold.current = null
      setComplete(false)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') reset()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', reset)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', reset)
    }
  }, [])
  useEffect(() => {
    if (!requiresPermission && state.status === 'idle') void requestPermission()
  }, [requiresPermission, state.status, requestPermission])

  // 新しいセンサー値が届いたときだけ判定し、非表示中の値では補正しない。
  useEffect(() => {
    if (saved.current || document.visibilityState === 'hidden') return
    const sample = getHorizontalCalibration({ ...state, webkitCompassHeading: state.compassHeading })
    if (state.status !== 'active' || !sample.canCalibrate || !sample.isHorizontal) {
      hold.current = null
      return
    }
    const now = performance.now()
    if (!hold.current || now - hold.current.lastSampleAt > MAX_SAMPLE_GAP_MS) {
      hold.current = { startedAt: now, lastSampleAt: now }
      return
    }
    hold.current.lastSampleAt = now
    if (now - hold.current.startedAt < CALIBRATION_HOLD_MS) return
    const captured = captureNorthCalibration(sample, Date.now())
    if (!captured) return
    saved.current = true
    saveNorthCalibration(captured)
    // Synchronize completion with the external sensor sample that finished the hold.
    // oxlint-disable-next-line react/set-state-in-effect
    setComplete(true)
  }, [state, saveNorthCalibration])

  useEffect(() => {
    if (!complete) return
    const timer = window.setTimeout(() => {
      if (saved.current && document.visibilityState !== 'hidden') navigate('/ar')
    }, CALIBRATION_COMPLETE_DISPLAY_MS)
    return () => window.clearTimeout(timer)
  }, [complete, navigate])

  return <main className={`mw-screen mw-calibration${complete ? ' is-complete' : ''}`}>
    <header className="mw-top"><AppLink to="/" navigate={navigate} className="mw-back"><span aria-hidden="true">←</span><span className="mw-sr-only">ホームへ戻る</span></AppLink></header>
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
        <p role="status"><span className="mw-calibration-status-dot" aria-hidden="true" />{complete ? 'センサーの準備完了' : state.message || '向きセンサーを取得中です'}</p>
      </div>
    </section>
  </main>
}
