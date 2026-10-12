import { describe, expect, it } from 'vitest'
import { getSunPosition } from './sunPosition'

describe('getSunPosition', () => {
  it('東京の昼は太陽が南寄りで地平線より上になる', () => {
    const sun = getSunPosition(35.6812, 139.7671, new Date('2026-10-05T12:00:00+09:00'))
    expect(sun.azimuth).toBeGreaterThan(160)
    expect(sun.azimuth).toBeLessThan(210)
    expect(sun.altitude).toBeGreaterThan(40)
    expect(sun.altitude).toBeLessThan(55)
    expect(sun.isAboveHorizon).toBe(true)
  })

  it('東京の深夜は太陽が地平線より下になる', () => {
    const sun = getSunPosition(35.6812, 139.7671, new Date('2026-10-05T00:00:00+09:00'))
    expect(sun.altitude).toBeLessThan(0)
    expect(sun.isAboveHorizon).toBe(false)
  })

  it('時刻と現在地の両方が計算に反映される', () => {
    const date = new Date('2026-10-05T12:00:00+09:00')
    const tokyo = getSunPosition(35.6812, 139.7671, date)
    const london = getSunPosition(51.5074, -0.1278, date)
    const later = getSunPosition(35.6812, 139.7671, new Date(date.getTime() + 3600000))
    expect(london.altitude).toBeLessThan(0)
    expect(later.azimuth).toBeGreaterThan(tokyo.azimuth)
    for (const sun of [tokyo, london, later]) {
      expect(sun.azimuth).toBeGreaterThanOrEqual(0)
      expect(sun.azimuth).toBeLessThan(360)
      expect(sun.altitude).toBeGreaterThanOrEqual(-90)
      expect(sun.altitude).toBeLessThanOrEqual(90)
    }
  })
})
