import { useEffect, useRef } from 'react'
import { useNorthCalibration } from './useNorthCalibration'
import { PROLONGED_POSE_INSTABILITY_MS, requiredRecalibrationMessage } from './recalibrationPolicy'

type Inputs = {
  ready: boolean
  orientationStatus: string
  sourceKey: string | null
  poseStatus: string
}

/** State/UX only: never infer drift from angles, or generate a correction. */
export function useARRecalibration({ ready, orientationStatus, sourceKey, poseStatus }: Inputs) {
  const { calibratedAt, requireNorthRecalibration, recommendRecalibration,
    recalibrationRecommended, recalibrationRecommendationReasons, dismissRecalibrationRecommendation,
    requiredRecalibrationReason } = useNorthCalibration()
  const sensor = useRef<{ epoch: number | null | undefined; source: string | null; interrupted: boolean }>({
    epoch: calibratedAt, source: null, interrupted: false,
  })

  useEffect(() => {
    if (!ready || sensor.current.epoch !== calibratedAt) {
      sensor.current = { epoch: calibratedAt, source: null, interrupted: false }
    }
    if (!ready) return
    if (['unavailable', 'error', 'denied', 'unsupported'].includes(orientationStatus)) {
      sensor.current.interrupted = true
      return
    }
    if (orientationStatus !== 'active') return
    if (sensor.current.interrupted) requireNorthRecalibration?.('orientation-recovered')
    else if (sourceKey !== null && sensor.current.source !== null && sourceKey !== sensor.current.source) {
      requireNorthRecalibration?.('sensor-source-changed')
    }
    sensor.current.source = sourceKey ?? sensor.current.source
  }, [ready, calibratedAt, orientationStatus, sourceKey, requireNorthRecalibration])

  useEffect(() => {
    if (!ready || orientationStatus !== 'active' || poseStatus !== 'unstable') return
    const timer = window.setTimeout(() => recommendRecalibration?.('prolonged-instability'), PROLONGED_POSE_INSTABILITY_MS)
    return () => window.clearTimeout(timer)
  }, [ready, calibratedAt, orientationStatus, poseStatus, recommendRecalibration])

  return {
    visible: ready && Boolean(recalibrationRecommended),
    reasons: recalibrationRecommendationReasons ?? [],
    dismiss: dismissRecalibrationRecommendation,
    requiredMessage: requiredRecalibrationMessage(requiredRecalibrationReason),
  }
}
