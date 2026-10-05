import { useEffect, useRef, useState } from 'react'
import { AppLink } from '../components/AppNavigation'
import type { Navigate } from '../components/AppNavigation'
import { useDeviceOrientation } from '../hooks/useDeviceOrientation'
import { useNorthCalibration } from '../hooks/useNorthCalibration'
import { getHorizontalCalibration, captureNorthCalibration } from '../lib/horizontalCalibration'
import './Frontend.css'

export const CALIBRATION_HOLD_MS = 700
export const CALIBRATION_COMPLETE_DISPLAY_MS = 600
const MAX_SAMPLE_GAP_MS = 250

export function CalibrationPage({ navigate }: { navigate: Navigate }) {
  const { state, requestPermission } = useDeviceOrientation()
  const { saveNorthCalibration } = useNorthCalibration()
  const [complete, setComplete] = useState(false)
  const saved = useRef(false)
  const hold = useRef<{ startedAt: number; lastSampleAt: number } | null>(null)
  const requiresPermission = typeof window !== 'undefined'
    && typeof (window.DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: unknown } | undefined)?.requestPermission === 'function'
  useEffect(() => {
    if (!requiresPermission && state.status === 'idle') void requestPermission()
  }, [requiresPermission, state.status, requestPermission])

  // Advance only when a new sensor sample arrives, never from a single held value.
  useEffect(() => {
    if (saved.current) return
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
    const timer = window.setTimeout(() => navigate('/ar'), CALIBRATION_COMPLETE_DISPLAY_MS)
    return () => window.clearTimeout(timer)
  }, [complete, navigate])

  return <main className={`mw-screen mw-calibration${complete ? ' is-complete' : ''}`}>
    <header className="mw-top"><AppLink to="/" navigate={navigate} className="mw-back"><span aria-hidden="true">←</span><span className="mw-sr-only">ホームへ戻る</span></AppLink></header>
    <section className="mw-calibration-content" aria-labelledby="calibration-title">
      <div className="mw-calibration-visual">
        <img className="mw-calibration-guide" src="/calibration-guide.png" alt="スマホをまっすぐ前に向けるイメージ" />
        <p className="mw-calibration-image-caption">スマホをまっすぐ前に向けてください</p>
      </div>
      <h1 id="calibration-title" className="mw-sr-only">向きセンサー</h1>
      <div className="mw-ar-controls mw-calibration-sensor">
        {requiresPermission && !complete && <button type="button" className="mw-primary" disabled={['requesting', 'waiting', 'active'].includes(state.status)} onClick={() => void requestPermission()}>向きセンサーを許可する</button>}
        <p role="status"><span className="mw-calibration-status-dot" aria-hidden="true" />{complete ? 'センサーの準備完了' : state.message || '向きセンサーを取得中です'}</p>
      </div>
    </section>
  </main>
}
