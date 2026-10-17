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

  it('初回をそのまま使い、以降は0.9/0.1で平滑化し、指定した符号でDownへ変換する', () => {
    const initial = { x: 0, y: 0, z: 9.8 }
    expect(filterAcceleration(null, initial)).toEqual(initial)
    const filtered = filterAcceleration(initial, { x: 0, y: 9.8, z: 0 })!
    expectVector(filtered, { x: 0, y: 0.98, z: 8.82 })
    const gravity = gravityFromAcceleration(filtered, 'raw-is-up')!
    expect(Math.hypot(gravity.x, gravity.y, gravity.z)).toBeCloseTo(1)
    expect(gravity.y).toBeLessThan(0)
    expect(gravity.z).toBeLessThan(0)
    expectVector(gravityFromAcceleration(initial, 'raw-is-up'), { x: 0, y: 0, z: -1 })
    expectVector(gravityFromAcceleration(initial, 'raw-is-down'), { x: 0, y: 0, z: 1 })
  })

  it.each([null, { x: null, y: 0, z: 9.8 }, { x: NaN, y: 0, z: 9.8 },
    { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 2 }, { x: 0, y: 0, z: 25 }])(
    '異常値はフィルタに混入させず理由を返す: %s', sample => {
      expect(accelerationIssue(sample)).not.toBeNull()
      expect(filterAcceleration({ x: 0, y: 0, z: 9.8 }, sample)).toBeNull()
      for (const convention of ['raw-is-down', 'raw-is-up'] as const) {
        expect(gravityFromAcceleration(filterAcceleration(null, sample), convention)).toBeNull()
      }
    },
  )

  it('平滑化で互いに打ち消したときも比較しない', () => {
    const filtered = { x: 0, y: 0, z: 0 }
    expect(gravityFromAcceleration(filtered, 'raw-is-down')).toBeNull()
    expect(accelerationIssue(filtered)).toContain('ベクトル長が極端')
  })
})

describe('DeviceMotion signs verified against physical device axes', () => {
  // +x = physical right edge, +y = physical top edge, +z = out of the screen.
  // Literal stationary readings for BOTH implementations, independent of matrix output.
  // iOS WebKit: totalAccel = Core Motion userAcceleration + gravity (no negation).
  // W3C: face-up example is +z, the opposite of physical Down.
  it.each([
    ['画面上向き', 0, 0, { x: 0, y: 0, z: -9.8 }, { x: 0, y: 0, z: 9.8 }, { x: 0, y: 0, z: -1 }],
    ['画面下向き', 180, 0, { x: 0, y: 0, z: 9.8 }, { x: 0, y: 0, z: -9.8 }, { x: 0, y: 0, z: 1 }],
    ['上端を上にして立てる', 90, 0, { x: 0, y: -9.8, z: 0 }, { x: 0, y: 9.8, z: 0 }, { x: 0, y: -1, z: 0 }],
    ['上端を下にして立てる', -90, 0, { x: 0, y: 9.8, z: 0 }, { x: 0, y: -9.8, z: 0 }, { x: 0, y: 1, z: 0 }],
    ['右端が下', 0, 90, { x: 9.8, y: 0, z: 0 }, { x: -9.8, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
    ['左端が下', 0, -90, { x: -9.8, y: 0, z: 0 }, { x: 9.8, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }],
  ] as const)('%s: iOSは反転なし、W3Cの例は反転ありで物理Downになる', (_pose, beta, gamma, ios, w3c, down) => {
    const iosDown = gravityFromAcceleration(filterAcceleration(null, ios), 'raw-is-down')
    const w3cDown = gravityFromAcceleration(filterAcceleration(null, w3c), 'raw-is-up')
    expectVector(iosDown, down)
    expectVector(w3cDown, down)
    const calculated = gravityFromCorrectedRotation(deviceOrientationToMatrix(37, beta, gamma))
    expectVector(calculated, down)
    expect(gravityAngleDegrees(iosDown, calculated)).toBeCloseTo(0, 5)
    expect(gravityAngleDegrees(w3cDown, calculated)).toBeCloseTo(0, 5)
    expect(gravityAngleDegrees(gravityFromAcceleration(ios, 'raw-is-up'), down)).toBeCloseTo(180, 5)
  })

  it('提供されたiPhone/Safariのraw値では、反転なしがDownと約3.50°、反転ありが約176.50°', () => {
    const raw = Object.freeze({ x: 0.3202, y: -10.8923, z: 0.5620 })
    const calculatedDown = { x: -0.0177, y: -0.9957, z: 0.0905 }
    const direct = gravityFromAcceleration(raw, 'raw-is-down')
    const inverted = gravityFromAcceleration(raw, 'raw-is-up')
    expectVector(direct, { x: 0.02934521842618224, y: -0.9982414823969546, z: 0.05150534901784642 })
    expect(gravityAngleDegrees(direct, calculatedDown)).toBeCloseTo(3.5047062163, 8)
    expect(gravityAngleDegrees(inverted, calculatedDown)).toBeCloseTo(176.4952937837, 8)
    expect(raw).toEqual({ x: 0.3202, y: -10.8923, z: 0.5620 })
  })

  it('提供された反転後の平滑化値は約177.74°、反転を取り消すと約2.26°', () => {
    // This is a different (filtered) reading; do not equate it with normalize(raw).
    const displayedNegated = { x: 0.0210, y: 0.9985, z: -0.0513 }
    const calculatedDown = { x: -0.0177, y: -0.9957, z: 0.0905 }
    const filteredBeforeNegation = { x: -0.0210 * 9.8, y: -0.9985 * 9.8, z: 0.0513 * 9.8 }
    expect(gravityAngleDegrees(displayedNegated, calculatedDown)).toBeCloseTo(177.7402148298, 8)
    expect(gravityAngleDegrees(gravityFromAcceleration(filteredBeforeNegation, 'raw-is-down'), calculatedDown)).toBeCloseTo(2.2597851702, 8)
  })

  it('行列に合うよう符号を選び直さず、姿勢が逆なら180°を保持する', () => {
    const iosFaceUp = { x: 0, y: 0, z: -9.8 }
    const sensorDown = gravityFromAcceleration(iosFaceUp, 'raw-is-down')
    const incorrectFaceDown = gravityFromCorrectedRotation(deviceOrientationToMatrix(0, 180, 0))
    expect(gravityAngleDegrees(sensorDown, incorrectFaceDown)).toBeCloseTo(180)
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
        expect(gravityAngleDegrees(gravityFromAcceleration(sensor, 'raw-is-up'), gravityFromCorrectedRotation(rotation))).toBeCloseTo(0, 5)
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
      for (const convention of ['raw-is-down', 'raw-is-up'] as const) {
        gravityAngleDegrees(gravityFromAcceleration(sample, convention), gravityFromCorrectedRotation(before.correctedRotation))
      }
      expect(JSON.stringify(before)).toBe(beforeJson)
      expect(getMoonDeviceState(orientation, northCorrection, moon)).toEqual(before)
      expect(getMoonInDevice(moon, before.deviceRotation!, northCorrection)).toEqual(before.moonInDevice)
      expect(projectMoonToScreen(before.moonInDevice!)).toEqual(projectMoonToScreen(getMoonInDevice(moon, before.deviceRotation!, 45)))
    }
  })
})
