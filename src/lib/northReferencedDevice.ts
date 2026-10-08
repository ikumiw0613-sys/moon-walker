import type { ViewDirection } from './coordinates'
import type { Matrix3, Vector3 } from '../types/vector3'
import { normalizeAzimuth } from './deviceView'
import { applyNorthCorrection, multiplyMatrixVector, transposeMatrix3 } from './vector3'

/** Camera forward in ENU. Heading is undefined at the zenith and nadir. */
export function getCameraView(cameraForward: Vector3 | null): ViewDirection | null {
  if (!cameraForward || !Object.values(cameraForward).every(Number.isFinite)
    || Math.hypot(cameraForward.x, cameraForward.y) < 1e-6) return null
  return {
    azimuth: normalizeAzimuth(Math.atan2(cameraForward.x, cameraForward.y) * 180 / Math.PI),
    altitude: Math.asin(Math.max(-1, Math.min(1, cameraForward.z))) * 180 / Math.PI,
  }
}

/**
 * The saved-calibration path verified by DebugPage's SunPreview.
 * Rz(northCorrection) × deviceRotation maps device axes to north-referenced ENU.
 * Live compass values are diagnostic only; they never add a second correction.
 */
export function getNorthReferencedDeviceRotation(
  deviceRotation: Matrix3 | null, northCorrection: number | null, compassHeading: number | null = null,
) {
  const validRotation = deviceRotation && deviceRotation.flat().every(Number.isFinite) ? deviceRotation : null
  const cameraForwardRaw = validRotation
    ? multiplyMatrixVector(validRotation, { x: 0, y: 0, z: -1 }) : null
  const rawView = getCameraView(cameraForwardRaw)
  const correctedRotation = validRotation && northCorrection !== null && Number.isFinite(northCorrection)
    ? applyNorthCorrection(validRotation, northCorrection) : null
  const inverseRotation = correctedRotation ? transposeMatrix3(correctedRotation) : null
  const cameraForwardCorrected = correctedRotation
    ? multiplyMatrixVector(correctedRotation, { x: 0, y: 0, z: -1 }) : null
  const correctedView = getCameraView(cameraForwardCorrected)
  const correctedHeading = correctedView?.azimuth ?? null
  const headingError = correctedHeading !== null && compassHeading !== null && Number.isFinite(compassHeading)
    ? normalizeAzimuth(correctedHeading - compassHeading + 180) - 180 : null
  return { correctedRotation, inverseRotation, cameraForwardRaw, rawView,
    cameraForwardCorrected, correctedView, correctedHeading, headingError }
}

/** Convert an ENU celestial direction using an already corrected rotation, exactly once. */
export function getCelestialDirectionInDevice(world: Vector3, correctedRotation: Matrix3): Vector3 {
  return multiplyMatrixVector(transposeMatrix3(correctedRotation), world)
}
