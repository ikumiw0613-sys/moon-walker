import { describe, expect, it } from 'vitest'
import { normalizeSignedAngle } from '../../shared/math/angles'
import { getMoonDeviceState } from '../moon-guide/moonDeviceNavigation'
import { projectMoonToScreen } from '../moon-guide/moonProjection'
import { captureNorthCalibration, getHorizontalCalibration } from '../north-calibration/horizontalCalibration'
import { getNorthCorrectionDiagnostics } from '../north-calibration/candidateNorthCorrection'
import { createPoseTracker, updatePoseStability } from '../device-orientation/poseStability'
import { appendCompassSample, getCompassQuality, getCompassStatistics } from './compassDiagnostics'
import type { CompassSample } from './compassDiagnostics'

// An audit of CURRENT behaviour, not an anti-drift implementation or a measured
// device trace. Physical pose and the synthetic celestial target are held fixed;
// use an illustrative rate by default and separately test the user-reported rate.
const moon = { azimuth: 90, altitude: 0, isAboveHorizon: true }
const initialOrientation = { alpha: 315, beta: 90, gamma: 0 }
const saved = captureNorthCalibration(getHorizontalCalibration({
  ...initialOrientation, webkitCompassHeading: 90,
}), 0)!

function inspect(seconds: number, relativeDrift: boolean, compassDrift: boolean, degreesPerSecond = 0.1) {
  let tracker = createPoseTracker(true)
  let samples: CompassSample[] = []
  let lastQuality = 'unavailable'
  let state = getMoonDeviceState(initialOrientation, saved.northCorrection, moon, 90)
  const initial = state
  for (let frame = 0; frame <= seconds * 60; frame++) {
    const at = frame * 1000 / 60
    const degrees = frame / 60 * degreesPerSecond
    const orientation = { ...initialOrientation, alpha: initialOrientation.alpha - (relativeDrift ? degrees : 0) }
    const compass = 90 + (compassDrift ? degrees : 0)
    state = getMoonDeviceState(orientation, saved.northCorrection, moon, compass)
    tracker = updatePoseStability(tracker, {
      at, rotation: state.correctedRotation!, heading: state.correctedHeading,
      altitude: state.correctedView!.altitude,
      // Pure yaw error has no discrepancy against the gravity direction.
      gravityDifference: 0,
    })
    const current = { at, heading: compass, accuracy: 1,
      candidate: getNorthCorrectionDiagnostics(state.deviceRotation, compass).candidateNorthCorrection }
    samples = appendCompassSample(samples, current)
    lastQuality = getCompassQuality(getCompassStatistics(samples), current).status
  }
  return { initial, state, tracker, lastQuality, stats: getCompassStatistics(samples),
    screen: projectMoonToScreen(state.moonInDevice!) }
}

describe('stationary drift audit of the existing production pipeline', () => {
  it('also misses the reported 1 degree/minute when reproduced as relative yaw drift', () => {
    const result = inspect(60, true, false, 1 / 60)
    expect(result.state.correctedHeading).toBeCloseTo(91)
    expect(result.state.headingError).toBeCloseTo(1)
    expect(result.tracker.status).toBe('stable')
    expect(result.lastQuality).toBe('good')
    expect(result.stats.candidate!.range).toBeLessThan(0.051)
  })

  it('does not accumulate numerical drift when sensor, time, location and target inputs stay identical', () => {
    const result = inspect(120, false, false)
    expect(result.state).toEqual(result.initial)
    expect(result.screen.x).toBeCloseTo(0.5)
    expect(result.state.correctedHeading).toBeCloseTo(90)
  })

  it('relative yaw can drift by 12 degrees while live compass is fixed and both quality/stability still pass', () => {
    const result = inspect(120, true, false)
    expect(result.state.correctedHeading).toBeCloseTo(102)
    expect(result.state.headingError).toBeCloseTo(12)
    expect(result.state.angleToMoon).toBeCloseTo(12)
    expect(result.state.navigation?.status).toBe('guiding')
    expect(result.tracker.status).toBe('stable')
    expect(result.lastQuality).toBe('good')
    expect(result.stats.candidate!.range).toBeLessThan(0.31)
    expect(result.stats.heading!.range).toBeCloseTo(0)
    expect(result.screen.x).toBeCloseTo(0.5 - Math.tan(12 * Math.PI / 180) / 2)
    const current = getNorthCorrectionDiagnostics(result.state.deviceRotation, 90).candidateNorthCorrection!
    expect(normalizeSignedAngle(current - saved.northCorrection)).toBeCloseTo(12)
    expect(saved.northCorrection).toBeCloseTo(-45)
  })

  it('live compass drift alone changes diagnostics but does not move the corrected pose or Moon marker', () => {
    const result = inspect(120, false, true)
    expect(result.state.correctedRotation).toEqual(result.initial.correctedRotation)
    expect(result.state.correctedHeading).toBeCloseTo(90)
    expect(result.state.headingError).toBeCloseTo(-12)
    expect(result.state.angleToMoon).toBeCloseTo(0)
    expect(result.screen.x).toBeCloseTo(0.5)
    expect(result.tracker.status).toBe('stable')
    expect(result.lastQuality).toBe('good')
  })

  it('common yaw/compass drift can keep candidate correction constant despite a 12-degree target error', () => {
    const result = inspect(120, true, true)
    expect(result.state.correctedHeading).toBeCloseTo(102)
    expect(result.state.headingError).toBeCloseTo(0)
    expect(result.state.angleToMoon).toBeCloseTo(12)
    expect(result.stats.candidate!.range).toBeCloseTo(0)
    expect(result.lastQuality).toBe('good')
    expect(result.tracker.status).toBe('stable')
  })
})
