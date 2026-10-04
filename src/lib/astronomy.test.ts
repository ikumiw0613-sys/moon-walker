import { describe, expect, it } from 'vitest'
import { getMoonPosition } from './astronomy'

describe('getMoonPosition', () => {
  it('月の方位角と高度を計算できる', () => {
    const latitude = 35.6812
    const longitude = 139.7671
    const date = new Date('2026-10-04T01:00:00Z')

    const result = getMoonPosition(
      latitude,
      longitude,
      date
    )

    expect(result.azimuth).toBeGreaterThanOrEqual(0)
    expect(result.azimuth).toBeLessThan(360)

    expect(result.altitude).toBeGreaterThanOrEqual(-90)
    expect(result.altitude).toBeLessThanOrEqual(90)
  })
  it('既知の月位置と大きくずれない', () => {
    const latitude = 35.6812
    const longitude = 139.7671
    const date = new Date('2026-10-04T01:00:00Z')

    const result = getMoonPosition(
      latitude,
      longitude,
      date
    )
  console.log(result)
  expect(Math.abs(result.azimuth - 275.71)).toBeLessThan(1)
  expect(Math.abs(result.altitude - 38.99)).toBeLessThan(1)
  })
  it('高度が正なら地平線より上と判定する', () => {
    const latitude = 35.6812
    const longitude = 139.7671
    const date = new Date('2026-10-04T01:00:00Z')

    const result = getMoonPosition(
      latitude,
      longitude,
      date
    )

    expect(result.isAboveHorizon).toBe(
      result.altitude > 0
    )
  })
})