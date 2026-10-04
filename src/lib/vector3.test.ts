import { describe, expect, it } from "vitest"
import { moonDirectionToVector } from "./vector3"
import { deviceOrientationToMatrix } from "./vector3"

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