import { describe, expect, it } from 'vitest'
import type { Matrix3, Vector3 } from '../../shared/math/types'
import { deviceOrientationToMatrix, applyNorthCorrection } from '../device-orientation/deviceRotation'
import { getMoonDeviceState, getMoonInDevice } from '../moon-guide/moonDeviceNavigation'
import { projectMoonToScreen } from '../moon-guide/moonProjection'
import { accelerationIssue, filterAcceleration, gravityAngleDegrees, gravityFromAcceleration,
  gravityFromCorrectedRotation, normalizeGravity } from './gravityDiagnostics'

function expectVector(actual: Vector3 | null, expected: Vector3) {
  expect(actual).not.toBeNull()
  for (const axis of ['x', 'y', 'z'] as const) expect(actual![axis]).toBeCloseTo(expected[axis], 10)
}

describe('debug gravity math', () => {
  it('正規化後の長さは1、元のベクトルは変更しない', () => {
    const vector = Object.freeze({ x: 3, y: 4, z: 12 })
    const normalized = normalizeGravity(vector)!
    expect(Math.hypot(normalized.x, normalized.y, normalized.z)).toBeCloseTo(1, 12)
    expectVector(normalized, { x: 3 / 13, y: 4 / 13, z: 12 / 13 })
    expect(vector).toEqual({ x: 3, y: 4, z: 12 })
  })

  it.each([
    [{ x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, 0],
    [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 90],
    [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, 180],
  ] as const)('dot積から角度%s / %s → %s°を得る', (a, b, angle) => {
    expect(gravityAngleDegrees(a, b)).toBeCloseTo(angle, 10)
  })

  it.each([null, { x: null, y: 1, z: 0 }, { x: NaN, y: 1, z: 0 },
    { x: Infinity, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1e-10, y: 0, z: 0 }])(
    'null・欠測・不正値・ゼロ長は安全に計算を中止: %s', vector => {
      expect(normalizeGravity(vector)).toBeNull()
      expect(gravityAngleDegrees(vector, { x: 0, y: 0, z: 1 })).toBeNull()
      expect(gravityAngleDegrees({ x: 0, y: 0, z: 1 }, vector)).toBeNull()
    },
  )

  it('初回をそのまま使い、以降は0.9/0.1で平滑化して下向きへ反転する', () => {
    const initial = { x: 0, y: 0, z: 9.8 }
    expect(filterAcceleration(null, initial)).toEqual(initial)
    const filtered = filterAcceleration(initial, { x: 0, y: 9.8, z: 0 })!
    expectVector(filtered, { x: 0, y: 0.98, z: 8.82 })
    const gravity = gravityFromAcceleration(filtered)!
    expect(Math.hypot(gravity.x, gravity.y, gravity.z)).toBeCloseTo(1)
    expect(gravity.y).toBeLessThan(0)
    expect(gravity.z).toBeLessThan(0)
    expectVector(gravityFromAcceleration(initial), { x: 0, y: 0, z: -1 })
  })

  it.each([null, { x: null, y: 0, z: 9.8 }, { x: NaN, y: 0, z: 9.8 },
    { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 2 }, { x: 0, y: 0, z: 25 }])(
    '異常値はフィルタに混入させず理由を返す: %s', sample => {
      expect(accelerationIssue(sample)).not.toBeNull()
      expect(filterAcceleration({ x: 0, y: 0, z: 9.8 }, sample)).toBeNull()
    },
  )

  it('平滑化で互いに打ち消したときも比較しない', () => {
    const filtered = { x: 0, y: 0, z: 0 }
    expect(gravityFromAcceleration(filtered)).toBeNull()
    expect(accelerationIssue(filtered)).toContain('ベクトル長が極端')
  })
})

describe('correctedRotation → device gravity fixed poses', () => {
  // Expectations are physical directions in the device axes, not generated with a rotation helper.
  it.each([
    [0, 0, { x: 0, y: 0, z: -1 }], // face up
    [90, 0, { x: 0, y: -1, z: 0 }], // portrait, top up
    [-90, 0, { x: 0, y: 1, z: 0 }], // portrait, top down
    [180, 0, { x: 0, y: 0, z: 1 }], // face down
    [0, 90, { x: 1, y: 0, z: 0 }], // landscape, right edge down
    [0, -90, { x: -1, y: 0, z: 0 }],
    [30, 60, { x: 0.75, y: -0.5, z: -Math.sqrt(3) / 4 }],
  ] as const)('beta=%s gamma=%sの固定姿勢', (beta, gamma, expected) => {
    for (const alpha of [0, 45, 270]) {
      for (const north of [0, -132, 90, 359]) {
        const rotation = applyNorthCorrection(deviceOrientationToMatrix(alpha, beta, gamma), north)
        expectVector(gravityFromCorrectedRotation(rotation), expected)
        const sensor = { x: -expected.x * 9.8, y: -expected.y * 9.8, z: -expected.z * 9.8 }
        expect(gravityAngleDegrees(gravityFromAcceleration(sensor), gravityFromCorrectedRotation(rotation))).toBeCloseTo(0, 5)
      }
    }
  })

  it('行列の未取得・不正値・不正形状・ゼロ長ではnull', () => {
    expect(gravityFromCorrectedRotation(null)).toBeNull()
    for (const matrix of [[], [[1]], [[1, 0, 0], [0, 1, 0], [0, 0, NaN]],
      [[0, 0, 0], [0, 0, 0], [0, 0, 0]]]) {
      expect(gravityFromCorrectedRotation(matrix as Matrix3)).toBeNull()
    }
  })

  it('診断でnorthCorrection・moonInDevice・projectionを変更しない', () => {
    const orientation = Object.freeze({ alpha: 0, beta: 90, gamma: 0 })
    const moon = Object.freeze({ azimuth: 0, altitude: 0, isAboveHorizon: true })
    const northCorrection = 45
    const before = getMoonDeviceState(orientation, northCorrection, moon)
    const beforeJson = JSON.stringify(before)
    before.correctedRotation!.forEach(Object.freeze)
    Object.freeze(before.correctedRotation)
    expect(before.correctedHeading).toBeCloseTo(315)
    expectVector(before.moonInDevice, { x: Math.SQRT1_2, y: 0, z: -Math.SQRT1_2 })
    expect(before.angleToMoon).toBeCloseTo(45)
    for (const sample of [{ x: 0, y: 9.8, z: 0 }, { x: 0, y: 0, z: 9.8 }, null]) {
      gravityAngleDegrees(gravityFromAcceleration(sample), gravityFromCorrectedRotation(before.correctedRotation))
      expect(JSON.stringify(before)).toBe(beforeJson)
      expect(getMoonDeviceState(orientation, northCorrection, moon)).toEqual(before)
      expect(getMoonInDevice(moon, before.deviceRotation!, northCorrection)).toEqual(before.moonInDevice)
      expect(projectMoonToScreen(before.moonInDevice!)).toEqual(projectMoonToScreen(getMoonInDevice(moon, before.deviceRotation!, 45)))
    }
  })
})
