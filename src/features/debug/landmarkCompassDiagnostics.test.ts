import { describe, expect, it } from 'vitest'
import { calculateBearing, calculateDistance } from '../../shared/geo/geographicBearing'
import { TOKYO_SKYTREE } from './landmarks'
import { getLandmarkAccuracy, getLandmarkCompassDiagnostics, LANDMARK_ACCURACY_LIMITS, MIN_LANDMARK_DISTANCE_METERS } from './landmarkCompassDiagnostics'

const input = {
  state: { status: 'success' as const, location: { latitude: TOKYO_SKYTREE.latitude - 0.01,
    longitude: TOKYO_SKYTREE.longitude, accuracy: 10, timestamp: 0 } },
  compassHeading: 10.7, correctedHeading: 10.1, rawHeading: 25, webkitCompassAccuracy: 10,
}

describe('landmark compass validation', () => {
  it('reuses Skytree coordinates and spherical initial bearing/distance utilities', () => {
    const data = getLandmarkCompassDiagnostics(input)
    const { latitude, longitude } = input.state.location
    expect(data.targetLocation).toBe(TOKYO_SKYTREE)
    expect(data.referenceBearing).toBe(calculateBearing(latitude, longitude, TOKYO_SKYTREE.latitude, TOKYO_SKYTREE.longitude))
    expect(data.distanceToTarget).toBe(calculateDistance(latitude, longitude, TOKYO_SKYTREE.latitude, TOKYO_SKYTREE.longitude))
    expect(data.referenceBearing).toBeCloseTo(0)
    expect(data.compassError).toBeCloseTo(10.7)
    expect(data.correctedHeadingError).toBeCloseTo(10.1)
    expect(data.absoluteError).toBeCloseTo(10.7)
    expect(data.landmarkAccuracy).toBe('BAD')
  })

  it('preserves the heading-minus-reference sign and wraps both sensor and corrected errors', () => {
    const data = getLandmarkCompassDiagnostics({ ...input, compassHeading: 359, correctedHeading: 350 })
    expect(data.compassError).toBeCloseTo(-1)
    expect(data.correctedHeadingError).toBeCloseTo(-10)
    expect(data.absoluteError).toBeCloseTo(1)
    const boundary = getLandmarkCompassDiagnostics({ ...input, compassHeading: 180, correctedHeading: -180 })
    expect(boundary.compassError).toBe(-180)
    expect(boundary.correctedHeadingError).toBe(-180)
  })

  it.each([0, 0.000001, 0.0001])('withholds bearing and errors at a same/nearby point (latitude offset %s)', delta => {
    const data = getLandmarkCompassDiagnostics({ ...input, state: { status: 'success', location: {
      ...input.state.location, latitude: TOKYO_SKYTREE.latitude + delta,
    } } })
    expect(data.distanceToTarget).toBeLessThan(MIN_LANDMARK_DISTANCE_METERS)
    expect(data).toMatchObject({ referenceBearing: null, compassError: null, correctedHeadingError: null, landmarkAccuracy: 'UNAVAILABLE' })
  })

  it('withholds comparison for missing/invalid locations and unavailable headings', () => {
    for (const state of [{ status: 'idle' as const }, { status: 'success' as const, location: { ...input.state.location, latitude: NaN } }]) {
      expect(getLandmarkCompassDiagnostics({ ...input, state })).toMatchObject({
        referenceBearing: null, compassError: null, landmarkAccuracy: 'UNAVAILABLE',
      })
    }
    for (const compassHeading of [null, NaN, -1, Infinity, 360]) {
      expect(getLandmarkCompassDiagnostics({ ...input, compassHeading }).landmarkAccuracy).toBe('UNAVAILABLE')
    }
  })

  it('compares a real compass without requiring calibration or Safari accuracy', () => {
    const data = getLandmarkCompassDiagnostics({ ...input, correctedHeading: null, webkitCompassAccuracy: undefined })
    expect(data.landmarkAccuracy).toBe('BAD')
    expect(data.correctedHeadingError).toBeNull()
    expect(data.webkitCompassAccuracy).toBeNull()
    expect(getLandmarkCompassDiagnostics({ ...input, webkitCompassAccuracy: -1 }).webkitCompassAccuracy).toBe(-1)
  })

  it.each([[0, 'GOOD'], [3, 'GOOD'], [-3, 'GOOD'], [3.01, 'CAUTION'], [7, 'CAUTION'], [-7, 'CAUTION'],
    [7.01, 'BAD'], [-11, 'BAD'], [null, 'UNAVAILABLE'], [NaN, 'UNAVAILABLE']] as const)(
    'classifies actual error %s as %s independently of stability/Safari accuracy', (error, expected) => {
      expect(getLandmarkAccuracy(error)).toBe(expected)
    },
  )

  it('keeps configurable limits diagnostic only', () => {
    expect(LANDMARK_ACCURACY_LIMITS).toEqual({ good: 3, caution: 7 })
  })
})
