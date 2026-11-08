import { describe, expect, it } from 'vitest'
import { calculateBearing, calculateDistance } from '../../shared/geo/geographicBearing'
import { YOMIURILAND_REFERENCE } from './landmarks'
import { getDebugMagneticDeclination } from './magneticDeclination'
import { getHeadingReferenceHypothesis, getLandmarkTrueNorthDiagnostics, HEADING_REFERENCE_LIMITS } from './landmarkTrueNorthDiagnostics'

const timestamp = Date.parse('2026-11-08T00:00:00Z')
const location = { latitude: YOMIURILAND_REFERENCE.latitude - 0.01,
  longitude: YOMIURILAND_REFERENCE.longitude, accuracy: 10, timestamp }
const magnetic = { ...getDebugMagneticDeclination(location, new Date(timestamp)), magneticDeclination: -7.5 }
const input = { state: { status: 'success' as const, location }, heading: 7.5, accuracy: 10,
  correctedHeading: 1, magnetic, timestamp }

describe('heading reference hypotheses (east-positive WMM)', () => {
  it.each([
    [0, -7.5, 'TRUE-NORTH-LIKE'], [-3, -7.5, 'TRUE-NORTH-LIKE'],
    [7.5, -7.5, 'MAGNETIC-NORTH-LIKE'], // West: magnetic = true + 7.5.
    [-7.5, 7.5, 'MAGNETIC-NORTH-LIKE'], // East: magnetic = true - 7.5.
    [-7.5, -7.5, 'INCONCLUSIVE'], // User example's inverted sign must not match.
    [25, -7.5, 'INCONCLUSIVE'], [0, 0, 'INCONCLUSIVE'], [1, -2, 'INCONCLUSIVE'],
    [null, -7.5, 'INCONCLUSIVE'], [0, null, 'INCONCLUSIVE'], [NaN, -7.5, 'INCONCLUSIVE'],
    [10.5, -7.5, 'MAGNETIC-NORTH-LIKE'], [10.5001, -7.5, 'INCONCLUSIVE'],
    [3.0001, -7.5, 'INCONCLUSIVE'], [179, 179, 'MAGNETIC-NORTH-LIKE'],
  ] as const)('difference=%s declination=%s yields %s', (difference, declination, expected) => {
    expect(getHeadingReferenceHypothesis(difference, declination)).toBe(expected)
  })
})

describe('Yomiuriland landmark observation', () => {
  it('uses the single target constant and the shared spherical bearing/Haversine utilities', () => {
    const result = getLandmarkTrueNorthDiagnostics(input)
    expect(result.referenceTarget).toBe(YOMIURILAND_REFERENCE.name)
    expect(result.targetLatitude).toBe(YOMIURILAND_REFERENCE.latitude)
    expect(result.targetLongitude).toBe(YOMIURILAND_REFERENCE.longitude)
    expect(result.trueBearing).toBe(calculateBearing(location.latitude, location.longitude, result.targetLatitude, result.targetLongitude))
    expect(result.distance).toBe(calculateDistance(location.latitude, location.longitude, result.targetLatitude, result.targetLongitude))
    expect(result).toMatchObject({ compassDifference: 7.5, absoluteDifference: 7.5, magneticDifference: 0,
      correctedHeadingDifference: 1, headingReferenceHypothesis: 'MAGNETIC-NORTH-LIKE' })
  })

  it('computes the shortest signed difference across 359/1 degrees', () => {
    // Bearing about 1 degree, then an exact +2 degree heading offset wrapped to 0..360.
    const state = { status: 'success' as const, location: { ...location, longitude: location.longitude + 0.0002 } }
    const bearing = calculateBearing(state.location.latitude, state.location.longitude,
      YOMIURILAND_REFERENCE.latitude, YOMIURILAND_REFERENCE.longitude)!
    expect(bearing).toBeGreaterThan(359)
    const result = getLandmarkTrueNorthDiagnostics({ ...input, state, heading: (bearing + 2) % 360, correctedHeading: bearing - 2 })
    expect(result.compassDifference).toBeCloseTo(2)
    expect(result.correctedHeadingDifference).toBeCloseTo(-2)
  })

  it('compares uncalibrated raw compass and preserves negative/unsupported Safari accuracy', () => {
    expect(getLandmarkTrueNorthDiagnostics({ ...input, correctedHeading: null, accuracy: -1 })).toMatchObject({
      webkitCompassAccuracy: -1, correctedHeadingDifference: null, headingReferenceHypothesis: 'MAGNETIC-NORTH-LIKE',
    })
    expect(getLandmarkTrueNorthDiagnostics({ ...input, accuracy: undefined }).webkitCompassAccuracy).toBeNull()
  })

  it('withholds hypothesis for missing/invalid location or heading without substituting alpha', () => {
    for (const state of [{ status: 'idle' as const }, { status: 'success' as const, location: { ...location, latitude: NaN } }]) {
      expect(getLandmarkTrueNorthDiagnostics({ ...input, state })).toMatchObject({
        trueBearing: null, compassDifference: null, headingReferenceHypothesis: 'INCONCLUSIVE',
      })
    }
    for (const heading of [null, NaN, -1, 360]) {
      expect(getLandmarkTrueNorthDiagnostics({ ...input, heading })).toMatchObject({
        webkitCompassHeading: null, compassDifference: null, headingReferenceHypothesis: 'INCONCLUSIVE',
      })
    }
  })

  it.each([0, 0.0001, 0.003])('warns and withholds hypothesis near target (latitude delta=%s)', delta => {
    const result = getLandmarkTrueNorthDiagnostics({ ...input, state: { status: 'success', location: {
      ...location, latitude: YOMIURILAND_REFERENCE.latitude - delta,
    } } })
    expect(result.gpsSensitive).toBe(true)
    expect(result.headingReferenceHypothesis).toBe('INCONCLUSIVE')
    if (result.distance! < HEADING_REFERENCE_LIMITS.minimumDistanceMeters) expect(result.targetTooClose).toBe(true)
  })

  it('also warns about poor GPS accuracy at longer distances', () => {
    const result = getLandmarkTrueNorthDiagnostics({ ...input, state: { status: 'success', location: { ...location, accuracy: 500 } } })
    expect(result.gpsBearingUncertainty).toBeGreaterThan(3)
    expect(result).toMatchObject({ gpsSensitive: true, headingReferenceHypothesis: 'INCONCLUSIVE' })
  })
})
