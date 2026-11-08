import { calculateBearing, calculateDistance } from '../../shared/geo/geographicBearing'
import { normalizeSignedAngle } from '../../shared/math/angles'
import type { LocationState } from '../geolocation/types'
import type { DebugMagneticDeclination } from './magneticDeclination'
import { YOMIURILAND_REFERENCE } from './landmarks'

// Diagnostic hypotheses, never calibration/AR acceptance criteria.
export const HEADING_REFERENCE_LIMITS = {
  toleranceDegrees: 3, minimumDistanceMeters: 50, distanceWarningMeters: 500,
  gpsWarningDegrees: 3,
} as const
export type HeadingReferenceHypothesis = 'TRUE-NORTH-LIKE' | 'MAGNETIC-NORTH-LIKE' | 'INCONCLUSIVE'

export function getHeadingReferenceHypothesis(difference: number | null, declination: number | null): HeadingReferenceHypothesis {
  if (difference === null || declination === null || ![difference, declination].every(Number.isFinite)) return 'INCONCLUSIVE'
  const trueLike = Math.abs(normalizeSignedAngle(difference)) <= HEADING_REFERENCE_LIMITS.toleranceDegrees
  // true = magnetic + D, hence magnetic - true = -D (east-positive WMM).
  const magneticLike = Math.abs(normalizeSignedAngle(difference + declination)) <= HEADING_REFERENCE_LIMITS.toleranceDegrees
  if (trueLike === magneticLike) return 'INCONCLUSIVE' // Both matching is ambiguous too.
  return trueLike ? 'TRUE-NORTH-LIKE' : 'MAGNETIC-NORTH-LIKE'
}

const finite = (value: number | null | undefined) => value != null && Number.isFinite(value) ? value : null

/** Pure readout of fresh real sensor values and the independent Debug model. */
export function getLandmarkTrueNorthDiagnostics({ state, heading, accuracy, correctedHeading, magnetic, timestamp }: {
  state: LocationState
  heading: number | null
  accuracy: number | null | undefined
  correctedHeading: number | null
  magnetic: DebugMagneticDeclination
  timestamp: number
}) {
  const location = state.status === 'success' ? state.location : null
  const target = YOMIURILAND_REFERENCE
  const distance = location ? calculateDistance(location.latitude, location.longitude, target.latitude, target.longitude) : null
  const targetTooClose = distance !== null && distance < HEADING_REFERENCE_LIMITS.minimumDistanceMeters
  const trueBearing = location && distance !== null
    ? calculateBearing(location.latitude, location.longitude, target.latitude, target.longitude) : null
  const sensorHeading = finite(heading)
  const webkitCompassHeading = sensorHeading !== null && sensorHeading >= 0 && sensorHeading < 360 ? sensorHeading : null
  const corrected = finite(correctedHeading)
  const compassDifference = webkitCompassHeading !== null && trueBearing !== null
    ? normalizeSignedAngle(webkitCompassHeading - trueBearing) : null
  const correctedHeadingDifference = corrected !== null && trueBearing !== null
    ? normalizeSignedAngle(corrected - trueBearing) : null
  const magneticDifference = compassDifference !== null && magnetic.magneticDeclination !== null
    ? normalizeSignedAngle(compassDifference + magnetic.magneticDeclination) : null
  const locationAccuracy = finite(location?.accuracy)
  const gpsBearingUncertainty = locationAccuracy !== null && locationAccuracy >= 0 && distance !== null && distance > 0
    ? Math.asin(Math.min(1, locationAccuracy / distance)) * 180 / Math.PI : null
  const gpsSensitive = targetTooClose || (distance !== null && distance < HEADING_REFERENCE_LIMITS.distanceWarningMeters)
    || (gpsBearingUncertainty !== null && gpsBearingUncertainty > HEADING_REFERENCE_LIMITS.gpsWarningDegrees)
  const unavailableReason = !location ? '現在地を取得してください。'
    : distance === null ? '現在地の座標が無効です。'
      : targetTooClose ? `対象まで${HEADING_REFERENCE_LIMITS.minimumDistanceMeters}m未満のため仮判定を停止します。`
        : trueBearing === null ? '方位が未確定です（同一点・対蹠点など）。'
          : webkitCompassHeading === null ? '有効な実機のwebkitCompassHeadingを取得してください（手動・古い値は比較しません）。'
            : magnetic.modelUnavailableReason
  const headingReferenceHypothesis = unavailableReason || gpsSensitive
    ? 'INCONCLUSIVE' as const : getHeadingReferenceHypothesis(compassDifference, magnetic.magneticDeclination)
  return {
    referenceTarget: target.name, targetLatitude: target.latitude, targetLongitude: target.longitude,
    currentLatitude: finite(location?.latitude), currentLongitude: finite(location?.longitude),
    locationAccuracy, locationTimestamp: location?.timestamp ?? null,
    distance, trueBearing, webkitCompassHeading, webkitCompassAccuracy: finite(accuracy),
    compassDifference, absoluteDifference: compassDifference === null ? null : Math.abs(compassDifference),
    correctedHeading: corrected, correctedHeadingDifference, magneticDifference,
    ...magnetic, headingReferenceHypothesis, targetTooClose, gpsSensitive, gpsBearingUncertainty,
    unavailableReason, timestamp,
  }
}
export type LandmarkTrueNorthDiagnostics = ReturnType<typeof getLandmarkTrueNorthDiagnostics>
