import { describe, expect, it } from 'vitest'
import { normalizeSignedAngle } from '../../shared/math/angles'
import { deviceOrientationToMatrix } from '../device-orientation/deviceRotation'
import { getHorizontalCalibration } from './horizontalCalibration'
import { CANDIDATE_HORIZONTAL_THRESHOLD, getCandidateNorthCorrection, getNorthCorrectionDiagnostics } from './candidateNorthCorrection'

const rotation = (heading: number, beta = 90) => deviceOrientationToMatrix(-heading, beta, 0)

describe('candidate north correction', () => {
  it.each([[0, 0, 0], [90, 101.1, -11.1], [0, 10, -10], [359, 1, -2], [1, 359, 2], [180, 0, -180]])(
    'raw %s°, compass %s° gives %s°', (raw, compass, expected) => {
      const matrix = rotation(raw)
      const before = structuredClone(matrix)
      expect(getCandidateNorthCorrection(matrix, compass)).toBeCloseTo(expected)
      const sample = getNorthCorrectionDiagnostics(matrix, compass)
      expect(sample.rawHeading).toBeCloseTo(raw)
      expect(sample.horizontalLength).toBeCloseTo(1)
      expect(sample.reason).toBeNull()
      expect(matrix).toEqual(before)
    },
  )

  it.each([null, NaN, Infinity, -Infinity])('rejects unavailable compass %s', compass => {
    expect(getCandidateNorthCorrection(rotation(90), compass)).toBeNull()
    expect(getNorthCorrectionDiagnostics(rotation(90), compass).reason).toBe('compass unavailable')
  })

  it.each([0, 180])('rejects vertical camera at beta %s', beta => {
    const sample = getNorthCorrectionDiagnostics(rotation(0, beta), 0)
    expect(sample.horizontalLength).toBeCloseTo(0)
    expect(sample.candidateNorthCorrection).toBeNull()
    expect(sample.rawHeading).toBeNull()
    expect(sample.reason).toBe('camera too vertical')
  })

  it('accepts 0.7 inclusively, but retains the calibration threshold of 0.9', () => {
    const atThreshold = deviceOrientationToMatrix(0, 90, 0)
    atThreshold[1][2] = -CANDIDATE_HORIZONTAL_THRESHOLD
    expect(getCandidateNorthCorrection(atThreshold, 0)).toBeCloseTo(0)
    const below = rotation(0, Math.asin(CANDIDATE_HORIZONTAL_THRESHOLD - 1e-6) * 180 / Math.PI)
    expect(getCandidateNorthCorrection(below, 0)).toBeNull()
    expect(getCandidateNorthCorrection(rotation(0, 60), 0)).toBeCloseTo(0)
    expect(getHorizontalCalibration({ alpha: 0, beta: 60, gamma: 0, webkitCompassHeading: 0 }).canCalibrate).toBe(false)
  })

  it('rejects missing or nonfinite rotation', () => {
    for (const matrix of [null, deviceOrientationToMatrix(NaN, 90, 0)]) {
      expect(getCandidateNorthCorrection(matrix, 0)).toBeNull()
      expect(getNorthCorrectionDiagnostics(matrix, 0).reason).toBe('device rotation unavailable')
    }
  })
})

it.each([[358, -2], [-358, 2], [180, -180], [-180, -180], [720, 0]])(
  'normalizeSignedAngle(%s) = %s', (input, expected) => {
    expect(normalizeSignedAngle(input)).toBe(expected)
  },
)
