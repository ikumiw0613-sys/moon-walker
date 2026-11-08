import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { NorthCalibration } from './horizontalCalibration'
import { NorthCalibrationContext } from './NorthCalibrationContext'
import { RECALIBRATION_RECOMMEND_AFTER_MS } from './recalibrationPolicy'
import type { RecalibrationRecommendationReason, RequiredRecalibrationReason } from './recalibrationPolicy'

type CalibrationState = {
  calibration: NorthCalibration | null
  requiredReason: RequiredRecalibrationReason | null
  recommendations: RecalibrationRecommendationReason[]
  dismissed: boolean
}
const INITIAL_STATE: CalibrationState = { calibration: null, requiredReason: null, recommendations: [], dismissed: false }

export function NorthCalibrationProvider({ children }: { children: ReactNode }) {
  // 画面遷移では保持するが、バックグラウンド移行時には古い方位基準を無効にする。
  const [state, setState] = useState<CalibrationState>(INITIAL_STATE)
  const { calibration, requiredReason, recommendations, dismissed } = state
  const saveNorthCalibration = useCallback((value: NorthCalibration) => {
    if (document.visibilityState === 'hidden') return
    if (!Number.isFinite(value.northCorrection) || !Number.isFinite(value.calibratedAt) || value.calibratedAt < 0) {
      setState({ ...INITIAL_STATE, requiredReason: 'invalid-calibration' })
      return
    }
    setState({ ...INITIAL_STATE, calibration: value })
  }, [])
  const requireNorthRecalibration = useCallback((reason: RequiredRecalibrationReason) => {
    setState(previous => previous.calibration ? { ...INITIAL_STATE, requiredReason: reason } : previous)
  }, [])
  const recommendRecalibration = useCallback((reason: RecalibrationRecommendationReason) => {
    setState(previous => !previous.calibration || previous.recommendations.includes(reason) ? previous
      : { ...previous, recommendations: [...previous.recommendations, reason], dismissed: false })
  }, [])
  const dismissRecalibrationRecommendation = useCallback(() => {
    setState(previous => previous.dismissed ? previous : { ...previous, dismissed: true })
  }, [])

  useEffect(() => {
    const invalidate = () => requireNorthRecalibration('resumed-from-background')
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') invalidate()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    // ページキャッシュから戻る場合も、保存前の補正を使い続けない。
    window.addEventListener('pagehide', invalidate)
    const orientation = window.screen.orientation
    const onOrientationChange = () => recommendRecalibration('screen-orientation-changed')
    orientation?.addEventListener('change', onOrientationChange)
    window.addEventListener('orientationchange', onOrientationChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', invalidate)
      orientation?.removeEventListener('change', onOrientationChange)
      window.removeEventListener('orientationchange', onOrientationChange)
    }
  }, [requireNorthRecalibration, recommendRecalibration])

  // Calibration age uses wall-clock time, independent of the Moon's test/current time.
  useEffect(() => {
    if (!calibration) return
    let timer: number
    const checkAge = () => {
      const remaining = calibration.calibratedAt + RECALIBRATION_RECOMMEND_AFTER_MS - Date.now()
      if (remaining <= 0) recommendRecalibration('stale-calibration')
      else timer = window.setTimeout(checkAge, Math.min(remaining, RECALIBRATION_RECOMMEND_AFTER_MS))
    }
    checkAge()
    return () => window.clearTimeout(timer)
  }, [calibration, recommendRecalibration])

  return (
    <NorthCalibrationContext.Provider value={{
      northCorrection: calibration?.northCorrection ?? null,
      calibrated: calibration !== null,
      calibratedAt: calibration?.calibratedAt ?? null,
      needsRecalibration: requiredReason !== null,
      requiredRecalibrationReason: requiredReason,
      recalibrationRecommended: calibration !== null && recommendations.length > 0 && !dismissed,
      recalibrationRecommendationReasons: recommendations,
      recommendRecalibration,
      dismissRecalibrationRecommendation,
      requireNorthRecalibration,
      saveNorthCalibration,
    }}>
      {children}
    </NorthCalibrationContext.Provider>
  )
}

