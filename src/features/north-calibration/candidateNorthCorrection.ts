import { normalizeAzimuth, normalizeSignedAngle } from '../../shared/math/angles'
import type { Matrix3 } from '../../shared/math/types'
import { multiplyMatrixVector } from '../../shared/math/vector3'

export const CANDIDATE_HORIZONTAL_THRESHOLD = 0.7

/** Read-only measurement; never saves or applies a correction. */
export function getNorthCorrectionDiagnostics(
  deviceRotation: Matrix3 | null,
  compassHeading: number | null,
  horizontalThreshold = CANDIDATE_HORIZONTAL_THRESHOLD,
) {
  const cameraForwardRaw = deviceRotation && deviceRotation.every(row => row.every(Number.isFinite))
    ? multiplyMatrixVector(deviceRotation, { x: 0, y: 0, z: -1 }) : null
  const horizontalLength = cameraForwardRaw ? Math.hypot(cameraForwardRaw.x, cameraForwardRaw.y) : null
  const isHorizontal = horizontalLength !== null && horizontalLength >= horizontalThreshold
  const rawHeading = isHorizontal && cameraForwardRaw
    ? normalizeAzimuth(Math.atan2(cameraForwardRaw.x, cameraForwardRaw.y) * 180 / Math.PI) : null
  const validCompassHeading = compassHeading !== null && Number.isFinite(compassHeading)
    ? normalizeAzimuth(compassHeading) : null
  const reason = !cameraForwardRaw ? 'device rotation unavailable'
    : !isHorizontal ? 'camera too vertical'
      : validCompassHeading === null ? 'compass unavailable' : null
  const candidateNorthCorrection = rawHeading !== null && validCompassHeading !== null
    ? normalizeSignedAngle(rawHeading - validCompassHeading) : null
  return { cameraForwardRaw, horizontalLength, isHorizontal, rawHeading,
    compassHeading: validCompassHeading, candidateNorthCorrection, reason }
}

export function getCandidateNorthCorrection(deviceRotation: Matrix3 | null, compassHeading: number | null): number | null {
  return getNorthCorrectionDiagnostics(deviceRotation, compassHeading).candidateNorthCorrection
}
