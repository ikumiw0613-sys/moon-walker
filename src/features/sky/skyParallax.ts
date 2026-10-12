import type { Matrix3, Vector3 } from '../../shared/math/types'
import { multiplyMatrixVector } from '../../shared/math/vector3'

export type ViewAngles = {
  heading: number
  altitude: number
}

const REAR_CAMERA_FORWARD: Vector3 = {
  x: 0,
  y: 0,
  z: -1,
}

export function getCameraForward(
  correctedRotation: Matrix3
): Vector3 {
  return multiplyMatrixVector(
    correctedRotation,
    REAR_CAMERA_FORWARD
  )
}

export function cameraVectorToViewAngles(
  vector: Vector3
): ViewAngles {
  const length = Math.hypot(
    vector.x,
    vector.y,
    vector.z
  )

  if (length === 0) {
    return {
      heading: 0,
      altitude: 0,
    }
  }

  const x = vector.x / length
  const y = vector.y / length
  const z = vector.z / length

  const heading =
    (
      Math.atan2(x, y) *
        180 /
        Math.PI +
      360
    ) % 360

  const altitude =
    Math.asin(
      Math.max(-1, Math.min(1, z))
    ) *
    180 /
    Math.PI

  return {
    heading,
    altitude,
  }
}