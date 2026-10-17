import type { Matrix3 } from '../../shared/math/types'
import { normalizeSignedAngle } from '../../shared/math/angles'

// Conservative initial limits for ~60Hz sensors. Both step size AND speed must exceed limits.
export const POSE_JUMP_WINDOW_MS = 120
export const HEADING_JUMP_DEGREES = 40
export const HEADING_JUMP_SPEED = 900
export const ALTITUDE_JUMP_DEGREES = 35
export const ALTITUDE_JUMP_SPEED = 700
export const ROTATION_JUMP_DEGREES = 50
export const ROTATION_JUMP_SPEED = 1200
export const HEADING_POLAR_ALTITUDE = 75
export const POSE_GAP_MS = 250
export const POSE_STALE_MS = 600
export const POSE_RECOVERY_MS = 350
export const POSE_RECOVERY_SAMPLES = 4
export const GRAVITY_MISMATCH_DEGREES = 25
export const GRAVITY_MISMATCH_MS = 700
export const GRAVITY_FRESH_MS = 250
export const GRAVITY_FILTER_ALIGNMENT_DEGREES = 12

export type PoseSample = {
  at: number
  rotation: Matrix3
  heading: number | null
  altitude: number
  gravityDifference: number | null
  gravityReason?: string | null
}
export type PoseStability = {
  status: 'stable' | 'unstable' | 'unavailable'
  reason: string
  headingDelta: number | null
  altitudeDelta: number | null
  rotationDelta: number | null
  intervalMs: number | null
  gravityDifference: number | null
  gravityReason: string | null
}
export type PoseTracker = PoseStability & {
  previous: PoseSample | null
  recoverySince: number | null
  recoverySamples: number
  gravityMismatchSince: number | null
}

export function createPoseTracker(active = false): PoseTracker {
  return { status: active ? 'stable' : 'unavailable', reason: active ? 'initial sample' : 'orientation unavailable',
    headingDelta: null, altitudeDelta: null, rotationDelta: null, intervalMs: null, gravityDifference: null, gravityReason: 'motion unavailable',
    previous: null, recoverySince: null, recoverySamples: 0, gravityMismatchSince: null }
}

export function validPoseRotation(rotation: Matrix3 | null): rotation is Matrix3 {
  return Array.isArray(rotation) && rotation.length === 3 && rotation.every(row => Array.isArray(row) && row.length === 3 && row.every(Number.isFinite))
}

/** SO(3) angular distance, including roll; never interpolate Euler angles or change either matrix. */
export function rotationDistanceDegrees(a: Matrix3, b: Matrix3): number {
  let trace = 0
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) trace += a[row][col] * b[row][col]
  return Math.acos(Math.max(-1, Math.min(1, (trace - 1) / 2))) * 180 / Math.PI
}

export function invalidatePose(tracker: PoseTracker, reason: string): PoseTracker {
  return { ...tracker, status: 'unavailable', reason, previous: null, recoverySince: null,
    recoverySamples: 0, gravityMismatchSince: null, gravityDifference: null, gravityReason: reason }
}

export function updatePoseStability(tracker: PoseTracker, sample: PoseSample): PoseTracker {
  if (!Number.isFinite(sample.at) || !Number.isFinite(sample.altitude) || !validPoseRotation(sample.rotation)
    || (sample.heading !== null && !Number.isFinite(sample.heading))) return invalidatePose(tracker, 'invalid orientation')
  const previous = tracker.previous
  const intervalMs = previous ? sample.at - previous.at : null
  // Duplicate renders / duplicate timestamps must not count toward recovery.
  if (intervalMs !== null && intervalMs <= 0) return tracker
  const headingDelta = previous && previous.heading !== null && sample.heading !== null
    ? normalizeSignedAngle(sample.heading - previous.heading) : null
  const altitudeDelta = previous ? sample.altitude - previous.altitude : null
  const rotationDelta = previous ? rotationDistanceDegrees(previous.rotation, sample.rotation) : null
  const gravityDifference = sample.gravityDifference !== null && Number.isFinite(sample.gravityDifference)
    ? sample.gravityDifference : null
  const gravityMismatchSince = gravityDifference !== null && gravityDifference > GRAVITY_MISMATCH_DEGREES
    ? tracker.gravityMismatchSince ?? sample.at : null
  let issue: string | null = null
  if (intervalMs !== null && intervalMs >= POSE_GAP_MS) issue = 'orientation update gap'
  else if (previous && intervalMs !== null && intervalMs <= POSE_JUMP_WINDOW_MS) {
    const seconds = Math.max(intervalMs, 8) / 1000
    // Heading becomes ill-conditioned near zenith/nadir; rely on full 3D distance there.
    if (headingDelta !== null && Math.max(Math.abs(sample.altitude), Math.abs(previous.altitude)) < HEADING_POLAR_ALTITUDE
      && Math.abs(headingDelta) >= HEADING_JUMP_DEGREES && Math.abs(headingDelta) / seconds >= HEADING_JUMP_SPEED) issue = 'heading jump'
    else if (altitudeDelta !== null && Math.abs(altitudeDelta) >= ALTITUDE_JUMP_DEGREES
      && Math.abs(altitudeDelta) / seconds >= ALTITUDE_JUMP_SPEED) issue = 'altitude jump'
    else if (rotationDelta !== null && rotationDelta >= ROTATION_JUMP_DEGREES
      && rotationDelta / seconds >= ROTATION_JUMP_SPEED) issue = 'rotation jump'
  }
  if (gravityMismatchSince !== null && sample.at - gravityMismatchSince >= GRAVITY_MISMATCH_MS) issue = 'gravity mismatch'
  const result: PoseTracker = { ...tracker, previous: sample, intervalMs, headingDelta, altitudeDelta, rotationDelta,
    gravityDifference, gravityMismatchSince, gravityReason: sample.gravityReason ?? (gravityDifference === null ? 'motion unavailable' : null) }
  if (issue) return { ...result, status: 'unstable', reason: issue, recoverySince: null, recoverySamples: 0 }
  if (tracker.status === 'stable') return { ...result, reason: 'normal updates' }
  const recoverySince = tracker.recoverySince ?? sample.at
  const recoverySamples = tracker.recoverySamples + 1
  const recovered = sample.at - recoverySince >= POSE_RECOVERY_MS && recoverySamples >= POSE_RECOVERY_SAMPLES
  return { ...result, recoverySince, recoverySamples, status: recovered ? 'stable' : 'unstable',
    reason: recovered ? 'normal updates' : tracker.reason }
}
