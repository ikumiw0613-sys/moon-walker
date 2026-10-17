import { useLayoutEffect, useEffect, useRef, useState } from 'react'
import type { Matrix3 } from '../../shared/math/types'
import type { MotionState } from '../device-motion/useDeviceMotion'
import type { GravitySensorConvention } from '../device-motion/gravityDiagnostics'
import { getCameraForward, cameraVectorToViewAngles } from '../sky/skyParallax'
import { getAuxiliaryGravity } from './auxiliaryGravity'
import { createPoseTracker, updatePoseStability, invalidatePose, validPoseRotation, POSE_STALE_MS } from './poseStability'

type StabilityInput = {
  rotation: Matrix3 | null
  heading: number | null
  active: boolean
  sampleId: number | null
  calibrationKey: number | null
  motion: MotionState
  gravityConvention: GravitySensorConvention | null
}

/** Confidence gate only: never smooth, replace, or hold a rotation used for projection. */
export function usePoseStability({ rotation, heading, active, sampleId, calibrationKey, motion, gravityConvention }: StabilityInput) {
  const [tracker, setTracker] = useState(() => createPoseTracker(active && validPoseRotation(rotation)))
  const trackerRef = useRef(tracker)
  const calibrationRef = useRef(calibrationKey)
  const motionRef = useRef({ motion, gravityConvention })
  const timeoutRef = useRef<number | undefined>(undefined)
  const rotationKey = rotation?.flat().join(',') ?? 'null'

  useLayoutEffect(() => { motionRef.current = { motion, gravityConvention } }, [motion, gravityConvention])

  useLayoutEffect(() => {
    function commit(next: typeof tracker) {
      trackerRef.current = next
      setTracker(next)
    }
    if (calibrationRef.current !== calibrationKey) {
      calibrationRef.current = calibrationKey
      trackerRef.current = createPoseTracker(active && validPoseRotation(rotation))
    }
    if (!active || !validPoseRotation(rotation)) {
      commit(invalidatePose(trackerRef.current, 'orientation unavailable'))
      return
    }
    const forward = getCameraForward(rotation)
    const altitude = cameraVectorToViewAngles(forward).altitude
    const gravity = getAuxiliaryGravity(motionRef.current.motion, rotation, Date.now(), motionRef.current.gravityConvention)
    commit(updatePoseStability(trackerRef.current, { at: performance.now(), rotation, heading, altitude,
      gravityDifference: gravity.angle, gravityReason: gravity.reason }))
    window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => {
      commit(invalidatePose(trackerRef.current, 'orientation updates stopped'))
    }, POSE_STALE_MS)
    return () => window.clearTimeout(timeoutRef.current)
    // Only accepted orientation samples / actual pose changes may refresh freshness or recovery.
    // Motion, moon/time, and other UI updates do not manufacture orientation samples.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [rotationKey, heading, sampleId, active, calibrationKey])

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') {
        window.clearTimeout(timeoutRef.current)
        const next = invalidatePose(trackerRef.current, 'page hidden')
        trackerRef.current = next
        setTracker(next)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearTimeout(timeoutRef.current)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])
  return tracker
}
