import { describe, expect, it } from 'vitest'
import { getDebugMagneticDeclination } from './magneticDeclination'

describe('Debug WMM calculation', () => {
  // NOAA published WMM2025 test vectors, altitude 0km, east-positive declination.
  // https://www.ncei.noaa.gov/sites/default/files/2025-02/WMM2025_TEST_VALUES.txt
  it.each([
    ['2025-01-01T00:00:00Z', 80, 0, 1.28],
    ['2025-01-01T00:00:00Z', 0, 120, -0.16],
    ['2025-01-01T00:00:00Z', -80, -120, 68.78],
    ['2027-07-02T12:00:00Z', 80, 0, 2.59],
    ['2027-07-02T12:00:00Z', -80, -120, 68.49],
  ])('matches NOAA at %s, lat=%s lon=%s', (date, latitude, longitude, expected) => {
    const value = getDebugMagneticDeclination({ latitude, longitude }, new Date(date))
    expect(value.magneticDeclination).toBeCloseTo(expected, 2)
    expect(value).toMatchObject({ modelName: 'WMM-2025', modelEpoch: 2025, modelUnavailableReason: null, modelAltitudeMeters: 0 })
  })

  it('returns west-negative declination near Yomiuriland and exposes actual model metadata', () => {
    const result = getDebugMagneticDeclination({ latitude: 35.625, longitude: 139.517 }, new Date('2026-11-08T00:00:00Z'))
    expect(result.magneticDeclination).toBeLessThan(-6)
    expect(result.magneticDeclination).toBeGreaterThan(-10)
    expect(result.modelDate).toBe('2026-11-08T00:00:00.000Z')
    expect(result.modelValidTo).toBe('2029-11-13T03:00:00.000Z')
  })

  it('returns reasons for unavailable/invalid locations, invalid dates and expired models', () => {
    const date = new Date('2026-11-08T00:00:00Z')
    for (const result of [
      getDebugMagneticDeclination(null, date),
      getDebugMagneticDeclination({ latitude: NaN, longitude: 139 }, date),
      getDebugMagneticDeclination({ latitude: 91, longitude: 139 }, date),
      getDebugMagneticDeclination({ latitude: 35, longitude: 181 }, date),
      getDebugMagneticDeclination({ latitude: 35, longitude: 139 }, new Date(NaN)),
      getDebugMagneticDeclination({ latitude: 35, longitude: 139 }, new Date('2035-01-01T00:00:00Z')),
    ]) {
      expect(result.magneticDeclination).toBeNull()
      expect(result.modelUnavailableReason).toBeTruthy()
    }
  })
})
