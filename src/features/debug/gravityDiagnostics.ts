import type { Matrix3, Vector3 } from '../../shared/math/types'
import { multiplyMatrixVector, transposeMatrix3 } from '../../shared/math/vector3'

export type AccelerationSample = { x: number | null; y: number | null; z: number | null }

export const GRAVITY_FILTER_PREVIOUS_WEIGHT = 0.9
export const MOTION_STALE_TIMEOUT_MS = 5000
// Diagnostic limits only (m/s²); these do not prove that the device is stationary.
export const MIN_GRAVITY_MAGNITUDE = 4.9
export const MAX_GRAVITY_MAGNITUDE = 14.7

export function normalizeGravity(vector: AccelerationSample | null): Vector3 | null {
  if (!vector || ![vector.x, vector.y, vector.z].every(value => typeof value === 'number' && Number.isFinite(value))) return null
  const { x, y, z } = vector as Vector3
  const length = Math.hypot(x, y, z)
  if (!Number.isFinite(length) || length < 1e-6) return null
  return { x: x / length, y: y / length, z: z / length }
}

export function accelerationIssue(sample: AccelerationSample | null): string | null {
  if (!sample) return 'データ未取得'
  if (![sample.x, sample.y, sample.z].every(value => typeof value === 'number' && Number.isFinite(value))) {
    return '加速度の欠測または不正値'
  }
  const { x, y, z } = sample as Vector3
  const length = Math.hypot(x, y, z)
  return length < MIN_GRAVITY_MAGNITUDE || length > MAX_GRAVITY_MAGNITUDE
    ? 'ベクトル長が極端（静止して再確認してください）' : null
}

export function filterAcceleration(previous: Vector3 | null, current: AccelerationSample | null): Vector3 | null {
  if (accelerationIssue(current)) return null
  const sample = current as Vector3
  if (!previous || accelerationIssue(previous)) return { ...sample }
  const weight = GRAVITY_FILTER_PREVIOUS_WEIGHT
  return {
    x: previous.x * weight + sample.x * (1 - weight),
    y: previous.y * weight + sample.y * (1 - weight),
    z: previous.z * weight + sample.z * (1 - weight),
  }
}

/**
 * W3C DeviceMotion reports proper acceleration: face-up at rest is (0, 0, +9.8).
 * Negate the filtered reading to express physical gravity (down) in device axes.
 * https://www.w3.org/TR/orientation-event/
 */
export function gravityFromAcceleration(filtered: Vector3 | null): Vector3 | null {
  if (accelerationIssue(filtered)) return null
  const unit = normalizeGravity(filtered)
  return unit ? { x: -unit.x, y: -unit.y, z: -unit.z } : null
}

/**
 * Existing northReferencedDevice.ts defines R as device → ENU, +Z = up.
 * Thus physical world gravity (0, 0, -1) in device axes is transpose(R) × down.
 * No screen rotation or additional north correction belongs in this comparison.
 */
export function gravityFromCorrectedRotation(rotation: Matrix3 | null): Vector3 | null {
  if (!Array.isArray(rotation) || rotation.length !== 3 || !rotation.every(row => Array.isArray(row)
    && row.length === 3 && row.every(value => typeof value === 'number' && Number.isFinite(value)))) return null
  return normalizeGravity(multiplyMatrixVector(transposeMatrix3(rotation), { x: 0, y: 0, z: -1 }))
}

export function gravityAngleDegrees(a: AccelerationSample | null, b: AccelerationSample | null): number | null {
  const first = normalizeGravity(a)
  const second = normalizeGravity(b)
  if (!first || !second) return null
  const dot = first.x * second.x + first.y * second.y + first.z * second.z
  return Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI
}
