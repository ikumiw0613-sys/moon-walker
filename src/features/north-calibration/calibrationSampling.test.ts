import { describe, expect, it } from 'vitest'
import { normalizeAzimuth } from '../../shared/math/angles'
import type { RawOrientationEvent } from '../device-orientation/useDeviceOrientation'
import { CALIBRATION_SAMPLING_LIMITS as limits, circularMedianAndRange, collectCalibrationEvent, createCalibrationCollection } from './calibrationSampling'

const start = 10_000
const first = start + limits.settlingMs
function event(at: number, candidate = -45, overrides: Partial<RawOrientationEvent> = {}): RawOrientationEvent {
  const heading = overrides.webkitCompassHeading ?? 90
  return { sequence: at, receivedAt: at, eventType: 'deviceorientation', absolute: false,
    alpha: normalizeAzimuth(-(heading + candidate)), beta: 90, gamma: 0,
    webkitCompassHeading: heading, webkitCompassAccuracy: 5, ...overrides }
}
function collect(values = Array.from({ length: 26 }, () => -45), overrides: Partial<RawOrientationEvent> = {}) {
  let state = createCalibrationCollection(start)
  values.forEach((candidate, i) => {
    const at = first + i * 100
    state = collectCalibrationEvent(state, event(at, candidate, overrides), at, 0)
  })
  return state
}

describe('stable north calibration sampling', () => {
  it('takes a robust circular median across 359/1 and -179/179 boundaries', () => {
    expect(circularMedianAndRange([359, 0, 1])).toEqual({ median: 0, range: 2 })
    expect(circularMedianAndRange([179, -179])).toEqual({ median: -180, range: 2 })
    const result = collect(Array.from({ length: 26 }, (_, i) => i % 2 ? 1 : 359))
    expect(result.phase).toBe('complete')
    expect(result.northCorrection).toBeCloseTo(0)
  })

  it('saves a median, not the last sample, after a full stable interval', () => {
    const result = collect([...Array.from({ length: 15 }, () => -45), -43])
    expect(result.phase).toBe('complete')
    expect(result.northCorrection).toBeCloseTo(-45)
    expect(result.samples.at(-1)!.candidate).toBeCloseTo(-43)
    expect(circularMedianAndRange([1, 2, 2, 2, 5])!.median).toBeCloseTo(2)
  })

  it('excludes a single large spike and does not use the rejected spike as the next baseline', () => {
    const values = Array.from({ length: 26 }, (_, i) => i === 12 ? 80 : -45)
    const result = collect(values)
    expect(result.phase).toBe('complete')
    expect(result.northCorrection).toBeCloseTo(-45)
    expect(result.samples).toHaveLength(15)
    expect(result.samples.every(value => Math.abs(value.candidate + 45) < 1e-8)).toBe(true)
  })

  it.each([
    { webkitCompassHeading: 110 }, { beta: 110 }, { gamma: 20 }, { alpha: 295 },
  ])('rejects a short-term jump in heading / beta / gamma / candidate (%o)', overrides => {
    const before = collect(Array.from({ length: 12 }, () => -45))
    const at = before.lastEventAt! + 100
    const after = collectCalibrationEvent(before, event(at, -45, overrides), at, 0)
    expect(after.phase).toBe('unstable')
    expect(after.samples).toEqual(before.samples)
    expect(after.lastValid).toBe(before.lastValid)
    expect(after.northCorrection).toBeNull()
  })

  it('does not complete on persistent spread, even if no individual step is a jump', () => {
    const result = collect(Array.from({ length: 100 }, (_, i) => -45 + i * 0.4))
    expect(result.phase).not.toBe('complete')
    expect(result.northCorrection).toBeNull()
  })

  it('requires a stable heading too, even if candidate stays constant while the phone turns', () => {
    let state = createCalibrationCollection(start)
    for (let i = 0; i < 40; i++) {
      const at = first + i * 100
      state = collectCalibrationEvent(state, event(at, -45, { webkitCompassHeading: 90 + i * 0.4 }), at, 0)
      expect(state.phase).not.toBe('complete')
    }
  })

  it.each([{ alpha: NaN }, { beta: Infinity }, { gamma: NaN }, { webkitCompassHeading: undefined },
    { webkitCompassHeading: -1 }, { webkitCompassHeading: NaN }, { beta: 60 }])('excludes invalid and non-horizontal samples (%o)', overrides => {
    const result = collect(undefined, overrides)
    expect(result.phase).not.toBe('complete')
    expect(result.samples).toHaveLength(0)
    expect(result.northCorrection).toBeNull()
  })

  it.each([-1, 21, Infinity, NaN])('holds calibration for unusable compass accuracy %s', webkitCompassAccuracy => {
    expect(collect(undefined, { webkitCompassAccuracy }).phase).toBe('accuracy')
  })

  it('supports missing accuracy, and does not lock out devices that never supply it', () => {
    expect(collect(undefined, { webkitCompassAccuracy: undefined }).phase).toBe('complete')
    expect(collect(undefined, { webkitCompassAccuracy: 20 }).phase).toBe('complete')
  })

  it('does not decide before 1.5 seconds, with too few samples, or from duplicate events', () => {
    expect(collect(Array.from({ length: 15 }, () => -45)).phase).not.toBe('complete')
    let state = createCalibrationCollection(start)
    for (let i = 0; i < 9; i++) {
      const at = first + i * 400
      state = collectCalibrationEvent(state, event(at), at, 0)
      expect(state.phase).not.toBe('complete')
    }
    expect(state.northCorrection).toBeNull()
    state = createCalibrationCollection(start)
    const one = event(first)
    state = collectCalibrationEvent(state, one, first, 0)
    for (let i = 0; i < 100; i++) state = collectCalibrationEvent(state, one, first, 0)
    expect(state.samples).toHaveLength(1)
  })

  it('drops the full window and quarantines readings on source or screen changes', () => {
    for (const sourceChange of [true, false]) {
      const before = collect(Array.from({ length: 20 }, () => -45))
      const at = before.lastEventAt! + 100
      const current = event(at, -45, sourceChange ? { eventType: 'deviceorientationabsolute', absolute: true } : {})
      const screen = sourceChange ? 0 : 90
      const after = collectCalibrationEvent(before, current, at, screen)
      expect(after.samples).toHaveLength(0)
      expect(after.phase).toBe('settling')
      const warmup = collectCalibrationEvent(after, { ...current, receivedAt: at + 100 }, at + 100, screen)
      expect(warmup.samples).toHaveLength(0)
    }
  })

  it('does not carry a stable prefix across stale readings, missing data or update gaps', () => {
    const before = collect(Array.from({ length: 20 }, () => -45))
    const at = before.lastEventAt! + 100
    expect(collectCalibrationEvent(before, event(at, -45, { alpha: null }), at, 0).samples).toHaveLength(0)
    expect(collectCalibrationEvent(before, event(at), at + limits.maximumGapMs + 1, 0).samples).toHaveLength(0)
    expect(collectCalibrationEvent(before, event(at + limits.maximumGapMs), at + limits.maximumGapMs, 0).samples).toHaveLength(0)
    expect(collectCalibrationEvent(before, event(at - 1000), at - 1000, 0).samples).toHaveLength(0)
  })
})
