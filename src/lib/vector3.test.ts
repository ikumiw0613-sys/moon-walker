import { describe, expect, it } from "vitest"
import { moonDirectionToVector } from "./vector3"
import { deviceOrientationToMatrix } from "./vector3"
import type { Matrix3, Vector3 } from "../types/vector3"

describe("deviceOrientationToMatrix", () => {
  it("回転なしなら単位行列になる", () => {
    const result = deviceOrientationToMatrix(0, 0, 0)

    expect(result[0][0]).toBeCloseTo(1)
    expect(result[0][1]).toBeCloseTo(0)
    expect(result[0][2]).toBeCloseTo(0)

    expect(result[1][0]).toBeCloseTo(0)
    expect(result[1][1]).toBeCloseTo(1)
    expect(result[1][2]).toBeCloseTo(0)

    expect(result[2][0]).toBeCloseTo(0)
    expect(result[2][1]).toBeCloseTo(0)
    expect(result[2][2]).toBeCloseTo(1)
  })

  it("alpha=90°ならX軸がY軸方向へ回る", () => {
    const matrix = deviceOrientationToMatrix(90, 0, 0)

    const x = {
      x: matrix[0][0],
      y: matrix[1][0],
      z: matrix[2][0],
    }

    expect(x.x).toBeCloseTo(0)
    expect(x.y).toBeCloseTo(1)
    expect(x.z).toBeCloseTo(0)
  })

  it("回転しても軸ベクトルの長さは1", () => {
    const matrix = deviceOrientationToMatrix(30, 40, 20)

    const x = {
      x: matrix[0][0],
      y: matrix[1][0],
      z: matrix[2][0],
    }

    const length = Math.sqrt(
      x.x ** 2 +
      x.y ** 2 +
      x.z ** 2
    )

    expect(length).toBeCloseTo(1)
  })
})

describe("moonDirectionToVector", () => {
  it("北・高度0°を正しく変換する", () => {
    const result = moonDirectionToVector(0, 0)

    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(1)
    expect(result.z).toBeCloseTo(0)
  })

  it("東・高度0°を正しく変換する", () => {
    const result = moonDirectionToVector(90, 0)

    expect(result.x).toBeCloseTo(1)
    expect(result.y).toBeCloseTo(0)
    expect(result.z).toBeCloseTo(0)
  })

  it("天頂を正しく変換する", () => {
    const result = moonDirectionToVector(0, 90)

    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(0)
    expect(result.z).toBeCloseTo(1)
  })

  it("単位ベクトルになる", () => {
    const result = moonDirectionToVector(123, 42)

    const length = Math.sqrt(
      result.x ** 2 +
      result.y ** 2 +
      result.z ** 2
    )

    expect(length).toBeCloseTo(1)
  })
})


import {
  multiplyMatrixVector,
  transposeMatrix3,
} from "./vector3"

describe("world to device", () => {
  // alpha=270°, beta=90°, gamma=0°: 端末の右は南、上は天頂、背面は東。
  // 期待値はENU上の固定方向から定め、回転関数で生成しない。
  it("背面カメラが東を向くとき、東の月は端末座標の(0, 0, -1)になる", () => {
    const rotation: Matrix3 = deviceOrientationToMatrix(270, 90, 0)
    const cameraForward: Vector3 = { x: 0, y: 0, z: -1 }
    const cameraWorld = multiplyMatrixVector(rotation, cameraForward)

    expect(cameraWorld.x).toBeCloseTo(1, 10)
    expect(cameraWorld.y).toBeCloseTo(0, 10)
    expect(cameraWorld.z).toBeCloseTo(0, 10)

    const moonWorld: Vector3 = { x: 1, y: 0, z: 0 }
    const moonInDevice = multiplyMatrixVector(transposeMatrix3(rotation), moonWorld)

    expect(moonInDevice.x).toBeCloseTo(0, 10)
    expect(moonInDevice.y).toBeCloseTo(0, 10)
    expect(moonInDevice.z).toBeCloseTo(-1, 10)
  })

  it("背面カメラが北を向くとき、北の月も端末座標の(0, 0, -1)になる", () => {
    const rotation: Matrix3 = deviceOrientationToMatrix(0, 90, 0)
    const moonWorld: Vector3 = { x: 0, y: 1, z: 0 }
    const moonInDevice = multiplyMatrixVector(transposeMatrix3(rotation), moonWorld)

    expect(moonInDevice.x).toBeCloseTo(0, 10)
    expect(moonInDevice.y).toBeCloseTo(0, 10)
    expect(moonInDevice.z).toBeCloseTo(-1, 10)
  })

  it("東向きのカメラから右45°にある南東の月は、端末の+x側かつ前方になる", () => {
    const rotation: Matrix3 = deviceOrientationToMatrix(270, 90, 0)
    const moonWorld: Vector3 = { x: Math.SQRT1_2, y: -Math.SQRT1_2, z: 0 }
    const moonInDevice = multiplyMatrixVector(transposeMatrix3(rotation), moonWorld)

    expect(moonInDevice.x).toBeCloseTo(Math.SQRT1_2, 10)
    expect(moonInDevice.y).toBeCloseTo(0, 10)
    expect(moonInDevice.z).toBeCloseTo(-Math.SQRT1_2, 10)
  })

  it("東向きのカメラから上45°にある月は、端末の+y側かつ前方になる", () => {
    const rotation: Matrix3 = deviceOrientationToMatrix(270, 90, 0)
    const moonWorld: Vector3 = { x: Math.SQRT1_2, y: 0, z: Math.SQRT1_2 }
    const moonInDevice = multiplyMatrixVector(transposeMatrix3(rotation), moonWorld)

    expect(moonInDevice.x).toBeCloseTo(0, 10)
    expect(moonInDevice.y).toBeCloseTo(Math.SQRT1_2, 10)
    expect(moonInDevice.z).toBeCloseTo(-Math.SQRT1_2, 10)
  })

  it("回転なしなら世界座標と端末座標が同じ", () => {
    const moonWorld = { x: 1, y: 0, z: 0 }

    const rotation = deviceOrientationToMatrix(0, 0, 0)
    const inverse = transposeMatrix3(rotation)

    const result = multiplyMatrixVector(inverse, moonWorld)

    expect(result.x).toBeCloseTo(1)
    expect(result.y).toBeCloseTo(0)
    expect(result.z).toBeCloseTo(0)
  })

  it("変換してもベクトルの長さは1", () => {
    const moonWorld = { x: 0.3, y: 0.4, z: Math.sqrt(0.75) }

    const rotation = deviceOrientationToMatrix(30, 40, 20)
    const inverse = transposeMatrix3(rotation)

    const result = multiplyMatrixVector(inverse, moonWorld)

    const length = Math.sqrt(
      result.x ** 2 +
      result.y ** 2 +
      result.z ** 2
    )

    expect(length).toBeCloseTo(1)
  })

  it("回転してから逆回転すると元に戻る", () => {
    const original = { x: 1, y: 0, z: 0 }

    const rotation = deviceOrientationToMatrix(45, 20, 10)

    const rotated = multiplyMatrixVector(rotation, original)

    const restored = multiplyMatrixVector(
      transposeMatrix3(rotation),
      rotated
    )

    expect(restored.x).toBeCloseTo(original.x)
    expect(restored.y).toBeCloseTo(original.y)
    expect(restored.z).toBeCloseTo(original.z)
  })
})
