import type { Matrix3 } from '../../shared/math/types'
import { multiplyMatrix3, rotationX, rotationY, rotationZ } from '../../shared/math/vector3'

function toRadians(degrees: number) {
  return degrees * Math.PI / 180
}

export function deviceOrientationToMatrix(
  alpha: number,
  beta: number,
  gamma: number
): Matrix3 {
  const a = toRadians(alpha)
  const b = toRadians(beta)
  const g = toRadians(gamma)

  const rz = rotationZ(a)
  const rx = rotationX(b)
  const ry = rotationY(g)

  return multiplyMatrix3(
    multiplyMatrix3(rz, rx),
    ry
  )
}


export function applyNorthCorrection(
  deviceRotation: Matrix3,
  northCorrection: number
): Matrix3 {
  const correction = rotationZ(toRadians(northCorrection))

  return multiplyMatrix3(
    correction,
    deviceRotation
  )
}