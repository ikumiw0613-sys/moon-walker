import { useEffect, useState } from 'react'
import type { RawOrientationEvent } from '../device-orientation/useDeviceOrientation'
import { deviceOrientationToMatrix } from '../device-orientation/deviceRotation'
import { getNorthCorrectionDiagnostics } from '../north-calibration/candidateNorthCorrection'
import { appendCompassSample, COMPASS_STALE_MS, COMPASS_WINDOW_MS, getCompassQuality, getCompassStatistics } from './compassDiagnostics'
import type { CompassSample } from './compassDiagnostics'

function sampleFromEvent(event: RawOrientationEvent): CompassSample {
  const { alpha, beta, gamma, webkitCompassHeading: heading, webkitCompassAccuracy: accuracy } = event
  const rotation = [alpha, beta, gamma].every(value => value !== null && Number.isFinite(value))
    ? deviceOrientationToMatrix(alpha!, beta!, gamma!) : null
  const validHeading = heading !== undefined && Number.isFinite(heading) && heading >= 0 ? heading : null
  return { at: event.receivedAt, heading: validHeading,
    accuracy: accuracy !== undefined && Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
    candidate: getNorthCorrectionDiagnostics(rotation, validHeading).candidateNorthCorrection }
}

/** Observe accepted real events only. UI renders, manual input and motion events never add samples. */
export function useCompassDiagnostics(event: RawOrientationEvent | null, active: boolean, manual: boolean) {
  const [samples, setSamples] = useState<CompassSample[]>([])
  const [now, setNow] = useState(() => Date.now())
  const [visible, setVisible] = useState(true)
  const eventKey = event ? [event.sequence, event.receivedAt, event.alpha, event.beta, event.gamma,
    event.webkitCompassHeading, event.webkitCompassAccuracy].join('|') : null
  // Accumulate externally acquired sensor events; deriving this history from the current event alone is impossible.
  /* oxlint-disable react/set-state-in-effect */
  useEffect(() => {
    if (!active || manual || !event) { setSamples([]); return }
    const sample = sampleFromEvent(event)
    setSamples(previous => appendCompassSample(previous, sample))
    setNow(Date.now())
    // Event identity is its acquisition sequence/time/values, not a wrapper object's reference.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [eventKey, active, manual])
  /* oxlint-enable react/set-state-in-effect */
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    const update = () => { setNow(Date.now()); setSamples([]); setVisible(document.visibilityState !== 'hidden') }
    document.addEventListener('visibilitychange', update)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update) }
  }, [])
  const age = event ? now - event.receivedAt : Infinity
  const reason = !visible ? 'ページ非表示中：再表示後にサンプルを取り直してください'
    : manual ? '手動テストON：実機の磁気環境診断は停止中'
    : !active || !event ? '実機コンパスを取得してください'
      : age < 0 || age > COMPASS_STALE_MS ? 'コンパスの更新停止・古いデータ' : null
  const recent = reason ? [] : samples.filter(sample => now - sample.at <= COMPASS_WINDOW_MS && now >= sample.at)
  const stats = getCompassStatistics(recent)
  const current = event && !reason ? sampleFromEvent(event) : null
  return { stats, current, quality: getCompassQuality(stats, current, reason), now }
}
