import type { Matrix3 } from '../../shared/math/types'
import type { MotionState } from '../device-motion/useDeviceMotion'
import type { GravitySensorConvention } from '../device-motion/gravityDiagnostics'
import { accelerationIssue, gravityFromAcceleration, gravityFromCorrectedRotation, gravityAngleDegrees } from '../device-motion/gravityDiagnostics'
import { GRAVITY_FRESH_MS, GRAVITY_FILTER_ALIGNMENT_DEGREES } from './poseStability'

/** Only use an implementation whose sign is known. Never choose the sign that agrees with R. */
export function getARGravityConvention(): GravitySensorConvention | null {
  if (typeof navigator === 'undefined') return null
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && /AppleWebKit/.test(navigator.userAgent) ? 'raw-is-down' : null
}

export function getAuxiliaryGravity(motion: MotionState, rotation: Matrix3 | null, now: number,
  convention: GravitySensorConvention | null) {
  if (!convention) return { angle: null, reason: 'gravity sign not verified for this browser' }
  const age = motion.lastReceivedAt === null ? Infinity : now - motion.lastReceivedAt
  if (!motion.updating || age < 0 || age > GRAVITY_FRESH_MS) return { angle: null, reason: 'motion unavailable or stale' }
  const issue = accelerationIssue(motion.accelerationIncludingGravity) ?? accelerationIssue(motion.filteredAcceleration)
  if (issue) return { angle: null, reason: issue }
  // A frame-based low-pass filter can lag a legitimate quick tilt, especially at low update rates.
  // Wait for raw and filtered motion to agree before treating a difference from R as evidence.
  const filterLag = gravityAngleDegrees(motion.accelerationIncludingGravity, motion.filteredAcceleration)
  if (filterLag === null || filterLag > GRAVITY_FILTER_ALIGNMENT_DEGREES) return { angle: null, reason: 'gravity filter settling or device moving' }
  const angle = gravityAngleDegrees(gravityFromAcceleration(motion.filteredAcceleration, convention), gravityFromCorrectedRotation(rotation))
  return { angle, reason: angle === null ? 'gravity comparison unavailable' : null }
}
