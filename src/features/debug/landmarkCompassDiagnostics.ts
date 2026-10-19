import { calculateBearing, calculateDistance, compareHeadingToBearing } from '../../shared/geo/geographicBearing'
import type { LocationState } from '../geolocation/types'
import { TOKYO_SKYTREE } from './landmarks'

// Debug only: never used for automatic correction or calibration acceptance.
export const LANDMARK_ACCURACY_LIMITS = { good: 3, caution: 7 } as const
export const MIN_LANDMARK_DISTANCE_METERS = 50
export type LandmarkAccuracy = 'GOOD' | 'CAUTION' | 'BAD' | 'UNAVAILABLE'

const finite = (value: number | null | undefined) => value != null && Number.isFinite(value) ? value : null

export function getLandmarkAccuracy(error: number | null): LandmarkAccuracy {
  if (error === null || !Number.isFinite(error)) return 'UNAVAILABLE'
  const absolute = Math.abs(error)
  return absolute <= LANDMARK_ACCURACY_LIMITS.good ? 'GOOD'
    : absolute <= LANDMARK_ACCURACY_LIMITS.caution ? 'CAUTION' : 'BAD'
}

/** Observe the same render's accepted sensor values. No orientation/correction side effects. */
export function getLandmarkCompassDiagnostics({ state, compassHeading, correctedHeading, rawHeading, webkitCompassAccuracy }: {
  state: LocationState
  compassHeading: number | null
  correctedHeading: number | null
  rawHeading: number | null
  webkitCompassAccuracy: number | null | undefined
}) {
  const location = state.status === 'success' ? state.location : null
  const distanceToTarget = location ? calculateDistance(location.latitude, location.longitude,
    TOKYO_SKYTREE.latitude, TOKYO_SKYTREE.longitude) : null
  const tooClose = distanceToTarget !== null && distanceToTarget < MIN_LANDMARK_DISTANCE_METERS
  const referenceBearing = location && distanceToTarget !== null && !tooClose
    ? calculateBearing(location.latitude, location.longitude, TOKYO_SKYTREE.latitude, TOKYO_SKYTREE.longitude) : null
  const heading = finite(compassHeading)
  const validCompassHeading = heading !== null && heading >= 0 && heading < 360 ? heading : null
  const corrected = finite(correctedHeading)
  const compassError = compareHeadingToBearing(validCompassHeading, referenceBearing)?.headingError ?? null
  const correctedHeadingError = compareHeadingToBearing(corrected, referenceBearing)?.headingError ?? null
  const unavailableReason = !location ? '現在地を取得してください。'
    : distanceToTarget === null ? '現在地の座標が無効です。'
    : tooClose ? `対象まで${MIN_LANDMARK_DISTANCE_METERS}m未満のため方位を確定しません。`
    : referenceBearing === null ? '方位を確定できません（同一点・対蹠点など）。'
    : validCompassHeading === null ? '有効な実機のwebkitCompassHeadingを取得してください（手動・古い値は比較しません）。' : null
  return { referenceTarget: '東京スカイツリー', targetLocation: TOKYO_SKYTREE, location,
    referenceBearing, distanceToTarget, compassHeading: validCompassHeading,
    compassError, absoluteError: compassError === null ? null : Math.abs(compassError),
    correctedHeading: corrected, correctedHeadingError, rawHeading: finite(rawHeading),
    webkitCompassAccuracy: finite(webkitCompassAccuracy), landmarkAccuracy: getLandmarkAccuracy(compassError), unavailableReason }
}

export type LandmarkCompassDiagnostics = ReturnType<typeof getLandmarkCompassDiagnostics>
