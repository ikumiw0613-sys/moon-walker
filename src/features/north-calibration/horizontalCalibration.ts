import { normalizeAzimuth } from '../../shared/math/angles'
import { deviceOrientationToMatrix } from '../device-orientation/deviceRotation'
import { getNorthCorrectionDiagnostics } from './candidateNorthCorrection'

// Camera direction must be within about 26° of the horizon.
export const HORIZONTAL_CALIBRATION_THRESHOLD = 0.9

type CalibrationInput = {
  alpha: number | null
  beta: number | null
  gamma: number | null
  webkitCompassHeading?: number | null
}

export type NorthCalibration = { northCorrection: number; calibratedAt: number }

export function getHorizontalCalibration(input: CalibrationInput | null) {
  const { alpha = null, beta = null, gamma = null } = input ?? {}
  const validOrientation = alpha !== null && beta !== null && gamma !== null
    && [alpha, beta, gamma].every(Number.isFinite)
  const deviceRotation = validOrientation
    ? deviceOrientationToMatrix(alpha, beta, gamma)
    : null
  const heading = input?.webkitCompassHeading
  const compassHeading = typeof heading === 'number' && Number.isFinite(heading) && heading >= 0 && heading <= 360
    ? normalizeAzimuth(heading) : null
  // Rz(correction) decreases atan2(East, North) by correction in this ENU convention.
  // Store the shortest signed rotation, in [-180, 180). Do not apply it here.
  const { cameraForwardRaw, horizontalLength, isHorizontal, rawHeading, candidateNorthCorrection: northCorrection }
    = getNorthCorrectionDiagnostics(deviceRotation, compassHeading, HORIZONTAL_CALIBRATION_THRESHOLD)
  return { cameraForwardRaw, horizontalLength, isHorizontal, rawHeading, compassHeading,
    northCorrection, canCalibrate: northCorrection !== null }
}

export function captureNorthCalibration(
  sample: ReturnType<typeof getHorizontalCalibration>, calibratedAt: number,
): NorthCalibration | null {
  return sample.canCalibrate && sample.northCorrection !== null
    ? { northCorrection: sample.northCorrection, calibratedAt } : null
}
