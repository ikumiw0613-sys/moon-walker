import type { Vector3, Matrix3 } from "../types/vector3"


function toRadians(degrees: number) {
  return degrees * Math.PI / 180
}

export function moonDirectionToVector(
  azimuth: number,
  altitude: number
): Vector3 {
  const az = toRadians(azimuth)
  const alt = toRadians(altitude)

  return {
    x: Math.cos(alt) * Math.sin(az), // East
    y: Math.cos(alt) * Math.cos(az), // North
    z: Math.sin(alt),                // Up
  }
}

function rotationZ(angle: number): Matrix3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)

  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ]
}

function rotationX(angle: number): Matrix3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)

  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ]
}

function rotationY(angle: number): Matrix3 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)

  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ]
}

function multiplyMatrix3(a: Matrix3, b: Matrix3): Matrix3 {
  return [
    [
      a[0][0] * b[0][0] + a[0][1] * b[1][0] + a[0][2] * b[2][0],
      a[0][0] * b[0][1] + a[0][1] * b[1][1] + a[0][2] * b[2][1],
      a[0][0] * b[0][2] + a[0][1] * b[1][2] + a[0][2] * b[2][2],
    ],
    [
      a[1][0] * b[0][0] + a[1][1] * b[1][0] + a[1][2] * b[2][0],
      a[1][0] * b[0][1] + a[1][1] * b[1][1] + a[1][2] * b[2][1],
      a[1][0] * b[0][2] + a[1][1] * b[1][2] + a[1][2] * b[2][2],
    ],
    [
      a[2][0] * b[0][0] + a[2][1] * b[1][0] + a[2][2] * b[2][0],
      a[2][0] * b[0][1] + a[2][1] * b[1][1] + a[2][2] * b[2][1],
      a[2][0] * b[0][2] + a[2][1] * b[1][2] + a[2][2] * b[2][2],
    ],
  ]
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


export function multiplyMatrixVector(
  matrix: Matrix3,
  vector: Vector3
): Vector3 {
  return {
    x:
      matrix[0][0] * vector.x +
      matrix[0][1] * vector.y +
      matrix[0][2] * vector.z,

    y:
      matrix[1][0] * vector.x +
      matrix[1][1] * vector.y +
      matrix[1][2] * vector.z,
    z:
      matrix[2][0] * vector.x +
      matrix[2][1] * vector.y +
      matrix[2][2] * vector.z,
  }
}

export function transposeMatrix3(
  matrix: Matrix3
): Matrix3 {
  return [
    [matrix[0][0], matrix[1][0], matrix[2][0]],
    [matrix[0][1], matrix[1][1], matrix[2][1]],
    [matrix[0][2], matrix[1][2], matrix[2][2]],
  ]
}

