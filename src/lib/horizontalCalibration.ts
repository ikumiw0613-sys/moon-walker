import { normalizeAzimuth } from './deviceView'
import { applyNorthCorrection, deviceOrientationToMatrix, multiplyMatrixVector } from './vector3'
import type { Matrix3 } from '../types/vector3'

// Camera direction must be within about 26° of the horizon.
export const HORIZONTAL_CALIBRATION_THRESHOLD = 0.9

type CalibrationInput = {
  alpha: number | null
  beta: number | null
  gamma: number | null
  webkitCompassHeading?: number | null
}

export type NorthCalibration = { northCorrection: number; calibratedAt: number }

// Diagnostic only: never feed this rotation into the Moon transform.
export function getCalibratedCameraDiagnostics(
  deviceRotation: Matrix3 | null, northCorrection: number | null, compassHeading: number | null,
) {
  const correctedRotation = deviceRotation && deviceRotation.flat().every(Number.isFinite)
    && northCorrection !== null && Number.isFinite(northCorrection)
    ? applyNorthCorrection(deviceRotation, northCorrection) : null
  const cameraForwardCorrected = correctedRotation
    ? multiplyMatrixVector(correctedRotation, { x: 0, y: 0, z: -1 }) : null
  // Heading is undefined when the camera points straight up or down.
  const correctedHeading = cameraForwardCorrected && Math.hypot(cameraForwardCorrected.x, cameraForwardCorrected.y) >= 1e-6
    ? normalizeAzimuth(Math.atan2(cameraForwardCorrected.x, cameraForwardCorrected.y) * 180 / Math.PI) : null
  const headingError = correctedHeading !== null && compassHeading !== null && Number.isFinite(compassHeading)
    ? normalizeAzimuth(correctedHeading - compassHeading + 180) - 180 : null
  return { correctedRotation, cameraForwardCorrected, correctedHeading, headingError }
}

export function getHorizontalCalibration(input: CalibrationInput | null) {
  const { alpha = null, beta = null, gamma = null } = input ?? {}
  const validOrientation = alpha !== null && beta !== null && gamma !== null
    && [alpha, beta, gamma].every(Number.isFinite)
  const cameraForwardRaw = validOrientation
    ? multiplyMatrixVector(deviceOrientationToMatrix(alpha, beta, gamma), { x: 0, y: 0, z: -1 })
    : null
  const horizontalLength = cameraForwardRaw ? Math.hypot(cameraForwardRaw.x, cameraForwardRaw.y) : null
  const isHorizontal = horizontalLength !== null && horizontalLength >= HORIZONTAL_CALIBRATION_THRESHOLD
  const rawHeading = isHorizontal && cameraForwardRaw
    ? normalizeAzimuth(Math.atan2(cameraForwardRaw.x, cameraForwardRaw.y) * 180 / Math.PI)
    : null
  const heading = input?.webkitCompassHeading
  const compassHeading = typeof heading === 'number' && Number.isFinite(heading) && heading >= 0 && heading <= 360
    ? normalizeAzimuth(heading) : null
  // Rz(correction) decreases atan2(East, North) by correction in this ENU convention.
  // Store the shortest signed rotation, in [-180, 180). Do not apply it here.
  const northCorrection = rawHeading !== null && compassHeading !== null
    ? normalizeAzimuth(rawHeading - compassHeading + 180) - 180 : null
  return { cameraForwardRaw, horizontalLength, isHorizontal, rawHeading, compassHeading,
    northCorrection, canCalibrate: northCorrection !== null }
}

export function captureNorthCalibration(
  sample: ReturnType<typeof getHorizontalCalibration>, calibratedAt: number,
): NorthCalibration | null {
  return sample.canCalibrate && sample.northCorrection !== null
    ? { northCorrection: sample.northCorrection, calibratedAt } : null
}
