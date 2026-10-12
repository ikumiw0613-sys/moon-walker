import { describe, expect, it } from 'vitest'
import { directionToVector } from './vector3'

describe("directionToVector", () => {
  it("北・高度0°を正しく変換する", () => {
    const result = directionToVector(0, 0)

    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(1)
    expect(result.z).toBeCloseTo(0)
  })

  it("東・高度0°を正しく変換する", () => {
    const result = directionToVector(90, 0)

    expect(result.x).toBeCloseTo(1)
    expect(result.y).toBeCloseTo(0)
    expect(result.z).toBeCloseTo(0)
  })

  it("天頂を正しく変換する", () => {
    const result = directionToVector(0, 90)

    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(0)
    expect(result.z).toBeCloseTo(1)
  })

  it("単位ベクトルになる", () => {
    const result = directionToVector(123, 42)

    const length = Math.sqrt(
      result.x ** 2 +
      result.y ** 2 +
      result.z ** 2
    )

    expect(length).toBeCloseTo(1)
  })
})


