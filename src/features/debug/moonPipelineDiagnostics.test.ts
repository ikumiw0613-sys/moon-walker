import { describe, expect, it } from 'vitest'
import type { Matrix3, Vector3 } from '../../shared/math/types'
import { multiplyMatrixVector } from '../../shared/math/vector3'
import type { LocationState } from '../geolocation/types'
import type { MoonPosition } from '../moon/types'
import { getMoonDeviceState } from '../moon-guide/moonDeviceNavigation'
import { projectMoonToScreen } from '../moon-guide/moonProjection'
import { getCameraForward, cameraVectorToViewAngles } from '../sky/skyParallax'
import {
  formatMoonPipelineDiagnostics,
  getMoonPipelineDiagnostics,
  type MoonPipelineContext,
  type MoonPipelineInput,
} from './moonPipelineDiagnostics'

const location: LocationState = {
  status: 'success',
  location: { latitude: 35.68, longitude: 139.76, accuracy: 10, timestamp: 0 },
}
const observationDate = new Date('2026-10-17T09:00:00+09:00')
const context: MoonPipelineContext = {
  observationDate,
  location,
  timeMode: 'current',
  orientationSource: 'sensor',
  orientationStatus: 'active',
  northCorrection: -45,
}
const moon: MoonPosition = { azimuth: 128, altitude: 32, isAboveHorizon: true }

function inputFor(
  orientation = { alpha: 315, beta: 80, gamma: 20 },
  moonPosition: MoonPosition | null = moon,
  northCorrection: number | null = -45,
): MoonPipelineInput {
  return {
    transform: getMoonDeviceState(orientation, northCorrection, moonPosition),
    moonPosition,
    context: { ...context, northCorrection },
  }
}

function freezeRecursively(value: unknown): void {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freezeRecursively)
    Object.freeze(value)
  }
}

function length(vector: Vector3): number {
  return Math.hypot(vector.x, vector.y, vector.z)
}

function snapshotFields(input: MoonPipelineInput): Map<string, string> {
  return new Map(formatMoonPipelineDiagnostics(getMoonPipelineDiagnostics(input))
    .split('\n').slice(1).map(line => {
      const separator = line.indexOf(': ')
      return [line.slice(0, separator), line.slice(separator + 2)]
    }))
}

describe('Moon transform pipeline diagnostics', () => {
  it.each([
    { alpha: 315, beta: 80, gamma: 20 },
    { alpha: 0, beta: 90, gamma: 0 },
    { alpha: 238, beta: -47, gamma: -69 },
    { alpha: 359, beta: 179, gamma: 83 },
  ])('preserves unit vectors and the production rotation for pose %o', orientation => {
    const input = inputFor(orientation)
    const before = structuredClone(input.transform)
    freezeRecursively(input.transform)
    const data = getMoonPipelineDiagnostics(input)

    expect(data.moonWorld).toBe(input.transform.moonWorld)
    expect(data.moonInDevice).toBe(input.transform.moonInDevice)
    expect(data.correctedRotation).toBe(input.transform.correctedRotation)
    expect(data.navigation).toBe(input.transform.navigation)
    expect(data.worldLength).toBeCloseTo(1, 12)
    expect(data.deviceLength).toBeCloseTo(1, 12)
    expect(length(data.moonWorld!)).toBeCloseTo(length(data.moonInDevice!), 12)

    const worldAgain = multiplyMatrixVector(data.correctedRotation!, data.moonInDevice!)
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(worldAgain[axis]).toBeCloseTo(data.moonWorld![axis], 12)
    }
    expect(data.projection.screen).toEqual(projectMoonToScreen(input.transform.moonInDevice!))
    formatMoonPipelineDiagnostics(data)
    expect(input.transform).toEqual(before)
  })

  it('derives the corrected forward and view angles with the shared AR helpers', () => {
    const input = inputFor()
    const data = getMoonPipelineDiagnostics(input)
    const forward = getCameraForward(input.transform.correctedRotation!)
    const view = cameraVectorToViewAngles(forward)

    expect(data.cameraForward).toEqual(forward)
    expect(data.cameraForward).toEqual(input.transform.cameraForwardCorrected)
    expect(data.correctedHeading).toBe(view.heading)
    expect(data.correctedHeading).toBeCloseTo(input.transform.correctedHeading!, 12)
    expect(data.correctedAltitude).toBe(view.altitude)
    expect(data.headingReason).toBeNull()
  })

  it.each([[0, -90], [180, 90]])('keeps heading undefined at beta=%s while retaining altitude=%s', (beta, altitude) => {
    const input = inputFor({ alpha: 0, beta, gamma: 0 })
    const data = getMoonPipelineDiagnostics(input)

    expect(input.transform.correctedHeading).toBeNull()
    expect(data.correctedHeading).toBeNull()
    expect(data.headingReason).toContain('camera vertical')
    expect(data.correctedAltitude).toBeCloseTo(altitude)
    expect(data.correctedAltitude).toBe(cameraVectorToViewAngles(getCameraForward(input.transform.correctedRotation!)).altitude)
    expect(data.projection.screen).toEqual(projectMoonToScreen(input.transform.moonInDevice!))
  })

  it.each([
    ['front', { azimuth: 0, altitude: 0, isAboveHorizon: true }],
    ['right', { azimuth: 30, altitude: 0, isAboveHorizon: true }],
    ['up', { azimuth: 0, altitude: 20, isAboveHorizon: true }],
    ['behind', { azimuth: 180, altitude: 0, isAboveHorizon: true }],
  ] as const)('exposes the same final projection as AR for a %s Moon', (direction, moonPosition) => {
    const input = inputFor({ alpha: 0, beta: 90, gamma: 0 }, moonPosition, 0)
    const { projection } = getMoonPipelineDiagnostics(input)

    expect(projection.screen).toEqual(projectMoonToScreen(input.transform.moonInDevice!))
    if (direction === 'front') {
      expect(projection.screen!.x).toBeCloseTo(0.5)
      expect(projection.screen!.y).toBeCloseTo(0.5)
      expect(projection.screen!.visible).toBe(true)
    } else if (direction === 'right') {
      expect(projection.screen!.x).toBeGreaterThan(0.5)
    } else if (direction === 'up') {
      expect(projection.screen!.y).toBeLessThan(0.5)
    } else {
      expect(projection.screen!.visible).toBe(false)
      expect(projection.reason).toBe('behind camera')
      expect(projection.normalizedX).toBeNull()
      expect(projection.normalizedY).toBeNull()
    }
  })

  it('explains unavailable astronomy inputs without manufacturing zero values', () => {
    const input = inputFor(undefined, null)
    input.context = { ...input.context, location: { status: 'idle' }, observationDate: null }
    const data = getMoonPipelineDiagnostics(input)

    expect(data.location).toBeNull()
    expect(data.observationTime).toBeNull()
    expect(data.moonPosition).toBeNull()
    expect(data.moonWorld).toBeNull()
    expect(data.moonInDevice).toBeNull()
    expect(data.worldLength).toBeNull()
    expect(data.deviceLength).toBeNull()
    expect(data.projection.screen).toBeNull()
    expect(data.navigation).toBeNull()
    expect(data.reasons.astronomy).toBe('location unavailable')
    expect(data.reasons.moonWorld).toBe('moon position unavailable')
    expect(data.reasons.moonInDevice).toBe('moonWorld unavailable')
    expect(data.reasons.projection).toBe('moonInDevice unavailable')

    const fields = snapshotFields(input)
    for (const key of ['time', 'latitude', 'longitude', 'moon.azimuth', 'moon.altitude',
      'moonWorld', 'moonInDevice', 'screenX', 'screenY', 'visible', 'angleToMoon']) {
      expect(fields.get(key)).toBe('unavailable')
    }
    expect(fields.get('pipeline.astronomy.status')).toBe('location unavailable')
  })

  it('distinguishes an invalid time, missing Moon, and missing corrected rotation', () => {
    const input = inputFor()
    const invalidTime = getMoonPipelineDiagnostics({ ...input, context: { ...context, observationDate: new Date(NaN) } })
    expect(invalidTime.observationTime).toBeNull()
    expect(invalidTime.reasons.astronomy).toBe('observationTime unavailable')
    expect(() => formatMoonPipelineDiagnostics(invalidTime)).not.toThrow()

    const noMoon = getMoonPipelineDiagnostics(inputFor(undefined, null))
    expect(noMoon.reasons.astronomy).toBe('moon position unavailable')

    const noCorrection = getMoonPipelineDiagnostics(inputFor(undefined, moon, null))
    expect(noCorrection.moonWorld).not.toBeNull()
    expect(noCorrection.correctedRotation).toBeNull()
    expect(noCorrection.cameraForward).toBeNull()
    expect(noCorrection.correctedHeading).toBeNull()
    expect(noCorrection.correctedAltitude).toBeNull()
    expect(noCorrection.moonInDevice).toBeNull()
    expect(noCorrection.reasons.deviceView).toBe('correctedRotation unavailable')
    expect(noCorrection.reasons.moonInDevice).toBe('correctedRotation unavailable')
  })

  it.each([NaN, Infinity, -Infinity])('handles non-finite input %s safely and labels it in the snapshot', invalid => {
    const moonPosition = { ...moon, azimuth: invalid }
    const input = inputFor(undefined, moonPosition, invalid)
    input.context = {
      ...input.context,
      location: { status: 'success', location: { latitude: invalid, longitude: 0, accuracy: 10, timestamp: 0 } },
    }
    const data = getMoonPipelineDiagnostics(input)

    expect(data.reasons.astronomy).toBe('location unavailable (non-finite coordinates)')
    expect(data.reasons.moonWorld).toBe('moon position unavailable (non-finite angles)')
    expect(data.cameraForward).toBeNull()
    expect(data.correctedHeading).toBeNull()
    expect(data.correctedAltitude).toBeNull()
    expect(data.worldLength).toBeNull()
    expect(data.deviceLength).toBeNull()
    expect(data.projection.screen).toBeNull()
    const fields = snapshotFields(input)
    expect(fields.get('latitude')).toBe('unavailable (non-finite)')
    expect(fields.get('moon.azimuth')).toBe('unavailable (non-finite)')
    expect(fields.get('northCorrection (saved, degrees)')).toBe('unavailable (non-finite)')
    expect(fields.get('longitude')).toBe('0')
    expect(fields.get('correctedHeading')).toBe('unavailable')
  })

  it('safely rejects invalid vectors and degenerate corrected forward vectors', () => {
    const input = inputFor()
    const invalidVector = { x: NaN, y: 0, z: -1 }
    const invalidRotation: Matrix3 = [[Infinity, 0, 0], [0, 1, 0], [0, 0, 1]]
    const data = getMoonPipelineDiagnostics({
      ...input,
      transform: { ...input.transform, moonWorld: invalidVector, moonInDevice: invalidVector,
        correctedRotation: invalidRotation, navigation: null },
    })
    expect(data.worldLength).toBeNull()
    expect(data.deviceLength).toBeNull()
    expect(data.cameraForward).toBeNull()
    expect(data.correctedHeading).toBeNull()
    expect(data.correctedAltitude).toBeNull()
    expect(data.projection.screen).toBeNull()
    expect(data.reasons.moonWorld).toContain('non-finite vector')
    expect(data.reasons.projection).toContain('non-finite input')
    expect(formatMoonPipelineDiagnostics(data)).toContain('moonWorld: (unavailable (non-finite), 0, -1)')
    expect(formatMoonPipelineDiagnostics(data)).toContain('correctedRotation: (unavailable (non-finite), 0, 0)')

    const zeroRotation: Matrix3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
    const degenerate = getMoonPipelineDiagnostics({ ...input, transform: { ...input.transform, correctedRotation: zeroRotation } })
    expect(degenerate.cameraForward).toBeNull()
    expect(degenerate.correctedHeading).toBeNull()
    expect(degenerate.correctedAltitude).toBeNull()
    expect(degenerate.reasons.deviceView).toContain('invalid vector length')
  })

  it('copies one complete sample with calculation context and preserves false and zero', () => {
    const moonPosition = { azimuth: 180, altitude: 0, isAboveHorizon: false }
    const input = inputFor({ alpha: 0, beta: 90, gamma: 0 }, moonPosition, 0)
    const fields = snapshotFields(input)
    const data = getMoonPipelineDiagnostics(input)

    expect(fields.get('time')).toBe(observationDate.toISOString())
    expect(fields.get('timeMode')).toBe('current')
    expect(fields.get('latitude')).toBe('35.68')
    expect(fields.get('longitude')).toBe('139.76')
    expect(fields.get('orientation.source')).toBe('sensor')
    expect(fields.get('orientation.status')).toBe('active')
    expect(fields.get('northCorrection (saved, degrees)')).toBe('0')
    expect(fields.get('moon.altitude')).toBe('0')
    expect(fields.get('moon.isAboveHorizon')).toBe('false')
    expect(fields.get('correctedHeading')).toBe('0')
    for (const key of ['cameraForward', 'moonWorld', 'moonInDevice', 'correctedRotation']) {
      expect(fields.get(key)).toMatch(/^\(/)
    }
    expect(fields.get('transform')).toBe('moonInDevice = transpose(correctedRotation) * moonWorld')
    expect(Number(fields.get('projection.depth'))).toBe(data.projection.depth)
    expect(fields.get('projection.horizontalFov (degrees)')).toBe('90')
    expect(fields.get('projection.verticalFov (degrees)')).toBe('60')
    expect(fields.get('projection.normalizedX')).toBe('unavailable')
    expect(fields.get('projection.normalizedY')).toBe('unavailable')
    expect(fields.get('screenX')).toBe('0.5')
    expect(fields.get('screenY')).toBe('0.5')
    expect(fields.get('visible')).toBe('false')
    expect(fields.get('navigation.status')).toBe(data.navigation!.status)
    expect(fields.get('navigation.arrow')).toBe(data.navigation!.arrow)
    expect(fields.get('navigation.message')).toBe(data.navigation!.message)
    expect(Number(fields.get('angleToMoon'))).toBe(data.navigation!.angleToMoon)
    expect(fields.get('pipeline.projection.status')).toBe('behind camera')
    expect(fields.get('MoonSprite.visible')).toBe('false')
  })

  it('includes numeric normalized coordinates and a centered zero angle in the copied sample', () => {
    const input = inputFor({ alpha: 0, beta: 90, gamma: 0 }, { azimuth: 0, altitude: 0, isAboveHorizon: true }, 0)
    const data = getMoonPipelineDiagnostics(input)
    const fields = snapshotFields(input)

    expect(Number(fields.get('projection.normalizedX'))).toBe(data.projection.normalizedX)
    expect(Number(fields.get('projection.normalizedY'))).toBe(data.projection.normalizedY)
    expect(fields.get('angleToMoon')).toBe('0')
    expect(fields.get('visible')).toBe('true')
    expect(fields.get('navigation.status')).toBe('centered')
    expect(fields.get('pipeline.projection.status')).toBe('available')
  })

  it('retains the production projection below the horizon while explaining AR rendering suppression', () => {
    const above = inputFor({ alpha: 0, beta: 90, gamma: 0 }, { azimuth: 0, altitude: 0, isAboveHorizon: true }, 0)
    const below = inputFor({ alpha: 0, beta: 90, gamma: 0 }, { azimuth: 0, altitude: 0, isAboveHorizon: false }, 0)
    const aboveData = getMoonPipelineDiagnostics(above)
    const belowData = getMoonPipelineDiagnostics(below)

    expect(belowData.projection).toEqual(aboveData.projection)
    expect(belowData.navigation).toEqual(aboveData.navigation)
    expect(belowData.projection.screen!.visible).toBe(true)
    expect(aboveData.reasons.MoonSprite).toBeNull()
    expect(belowData.reasons.MoonSprite).toContain('moon below horizon')
    expect(snapshotFields(below).get('pipeline.MoonSprite.status')).toContain('moon below horizon')
  })

  it('labels stale or manual diagnostic samples without changing shared transform outputs', () => {
    const input = inputFor({ alpha: 0, beta: 90, gamma: 0 }, { azimuth: 0, altitude: 0, isAboveHorizon: true }, 0)
    const activeData = getMoonPipelineDiagnostics(input)
    for (const sampleContext of [
      { ...input.context, orientationStatus: 'unavailable' },
      { ...input.context, orientationSource: 'manual' as const },
    ]) {
      const data = getMoonPipelineDiagnostics({ ...input, context: sampleContext })
      expect(data.moonInDevice).toBe(input.transform.moonInDevice)
      expect(data.correctedRotation).toBe(input.transform.correctedRotation)
      expect(data.projection).toEqual(activeData.projection)
      expect(data.navigation).toBe(input.transform.navigation)
      expect(data.reasons.MoonSprite).toContain(sampleContext.orientationSource === 'manual'
        ? 'Debug manual orientation' : 'orientation inactive')
    }
  })
})
