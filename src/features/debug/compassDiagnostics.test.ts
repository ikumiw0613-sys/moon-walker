import { describe, expect, it } from 'vitest'
import { normalizeSignedAngle } from '../../shared/math/angles'
import { angularStatistics, appendCompassSample, COMPASS_MAX_SAMPLES, COMPASS_MIN_SAMPLES,
  COMPASS_WINDOW_MS, getCompassQuality, getCompassStatistics } from './compassDiagnostics'
import type { CompassSample } from './compassDiagnostics'

const sample = (at: number, values: Partial<CompassSample> = {}): CompassSample => ({ at, heading: 228, accuracy: 6, candidate: 134, ...values })
const stable = Array.from({ length: COMPASS_MIN_SAMPLES }, (_, i) => sample(i * 100, { candidate: 134 + i % 2, heading: 228 + i % 2 }))
function quality(samples = stable, current = samples.at(-1)!) {
  return getCompassQuality(getCompassStatistics(samples), current)
}

describe('circular compass statistics', () => {
  it('candidate 359° / 1° and ±180° crossings use a local difference space', () => {
    const stats = angularStatistics([359, 0, 1])!
    expect(stats).toEqual({ count: 3, median: 0, min: 359, max: 1, range: 2, deviation: Math.sqrt(2 / 3) })
    const candidate = angularStatistics([179, -180, -179])!
    expect(normalizeSignedAngle(candidate.median)).toBe(-180)
    expect(candidate.range).toBe(2)
    expect(candidate.deviation).toBeCloseTo(Math.sqrt(2 / 3))
  })
  it('heading angular range is independent of ordering and equivalent wrapped angles', () => {
    for (const values of [[358, 2, 359, 1], [1, 359, 2, 358], [-2, 362, -1, 361]]) {
      const stats = angularStatistics(values)!
      expect(stats.range).toBe(4)
      expect(stats.median).toBe(0)
      expect(stats.deviation).toBeCloseTo(Math.sqrt(2.5))
    }
  })
  it('handles even medians, invalid inputs, a singleton and widely spread directions', () => {
    expect(angularStatistics([])).toBeNull()
    expect(angularStatistics([NaN, Infinity])).toBeNull()
    expect(angularStatistics([42, NaN])).toEqual({ count: 1, median: 42, min: 42, max: 42, range: 0, deviation: 0 })
    expect(angularStatistics([0, 90, 180, 270])!.range).toBe(270)
    expect(angularStatistics([359, 1])!.median).toBe(0)
  })
})

describe('Debug-only compass quality', () => {
  it('requires accuracy and both stability measurements for GOOD', () => {
    expect(quality().status).toBe('good')
    const stats = getCompassStatistics(stable)
    expect(stats.accuracy).toMatchObject({ median: 6, min: 6, max: 6, count: COMPASS_MIN_SAMPLES })
  })
  it.each([[10, 'good'], [12, 'caution'], [20, 'caution'], [21, 'poor']] as const)('accuracy %s gives %s', (accuracy, status) => {
    expect(quality(stable.map(value => ({ ...value, accuracy }))).status).toBe(status)
  })
  it('reacts immediately to worsening current accuracy and retains poor median evidence', () => {
    expect(quality(stable, sample(1000, { accuracy: 21 })).status).toBe('poor')
    expect(quality(stable.map(value => ({ ...value, accuracy: 25 })), sample(1000)).status).toBe('poor')
  })
  it.each(['candidate', 'heading'] as const)('combines %s range with accuracy', key => {
    for (const [range, status] of [[3, 'good'], [4, 'caution'], [8, 'caution'], [9, 'poor']] as const) {
      const samples = stable.map((value, i) => ({ ...value, [key]: i % 2 ? 100 + range : 100 }))
      expect(quality(samples).status).toBe(status)
    }
  })
  it('missing current values and insufficient samples are UNAVAILABLE', () => {
    expect(quality(stable.slice(1)).status).toBe('unavailable')
    for (const key of ['accuracy', 'heading', 'candidate'] as const) {
      expect(quality(stable, sample(1000, { [key]: null })).status).toBe('unavailable')
    }
    expect(getCompassQuality(getCompassStatistics(stable), null).status).toBe('unavailable')
    expect(getCompassQuality(getCompassStatistics(stable), stable[0], '更新停止')).toEqual({ status: 'unavailable', reasons: ['更新停止'] })
  })
})

describe('compass sampling window', () => {
  it('limits history to 30 samples, 3 seconds, and one sample per 100ms', () => {
    let values: CompassSample[] = []
    for (let i = 0; i < 60; i++) values = appendCompassSample(values, sample(i * 100))
    expect(values).toHaveLength(COMPASS_MAX_SAMPLES)
    expect(values[0].at).toBe(3000)
    expect(appendCompassSample(values, sample(5901))).toHaveLength(COMPASS_MAX_SAMPLES)
    expect(appendCompassSample(values, sample(5900 + COMPASS_WINDOW_MS + 1))).toEqual([sample(8901)])
  })
})
