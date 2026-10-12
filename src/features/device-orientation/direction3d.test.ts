import { describe, expect, it } from 'vitest'
import { azimuthAltitudeToEnu, deviceOrientationToRotationMatrix, enuToDevice } from './direction3d'
import type { Vector3 } from './direction3d'
import { getDeviceView } from './deviceView'

function expectVector(actual: Vector3, expected: Vector3): void {
  expect(actual.x).toBeCloseTo(expected.x, 10)
  expect(actual.y).toBeCloseTo(expected.y, 10)
  expect(actual.z).toBeCloseTo(expected.z, 10)
}

describe('azimuthAltitudeToEnu', () => {
  it.each([
    [0, 0, { x: 0, y: 1, z: 0 }],
    [90, 0, { x: 1, y: 0, z: 0 }],
    [180, 0, { x: 0, y: -1, z: 0 }],
    [270, 0, { x: -1, y: 0, z: 0 }],
    [42, 90, { x: 0, y: 0, z: 1 }],
    [42, -90, { x: 0, y: 0, z: -1 }],
  ])('方位%s°・高度%s°をENUへ変換する', (azimuth, altitude, expected) => {
    expectVector(azimuthAltitudeToEnu(azimuth, altitude), expected)
  })

  it.each([[0, 0], [123, 45], [359, -70], [-15, 20], [720, 90]])(
    '方位%s°・高度%s°のベクトル長は1', (azimuth, altitude) => {
      const { x, y, z } = azimuthAltitudeToEnu(azimuth, altitude)
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 10)
    },
  )

  it('0°/360°境界で同じ方向を表す', () => {
    expectVector(azimuthAltitudeToEnu(-1, 30), azimuthAltitudeToEnu(359, 30))
    expectVector(azimuthAltitudeToEnu(361, 30), azimuthAltitudeToEnu(1, 30))
  })

  it.each([[NaN, 0], [0, Infinity], [0, 91], [0, -91]])(
    '無効な角度%s・%sを拒否する', (azimuth, altitude) => {
      expect(() => azimuthAltitudeToEnu(azimuth, altitude)).toThrow(RangeError)
    },
  )
})

describe('deviceOrientationToRotationMatrix / enuToDevice', () => {
  it('無回転は単位行列となる', () => {
    const rotation = deviceOrientationToRotationMatrix({ alpha: 0, beta: 0, gamma: 0 })!
    expectVector(enuToDevice({ x: 1, y: 2, z: 3 }, rotation), { x: 1, y: 2, z: 3 })
  })

  it.each([
    [0, 90, 0, 0, 0],
    [270, 90, 0, 90, 0],
    [0, 120, 0, 0, 30],
    [0, 0, -90, 90, 0],
    [0, 180, 0, 42, 90],
    [0, 0, 0, 42, -90],
  ])('姿勢(%s,%s,%s)の背面前方にある月(%s,%s)は端末-Zになる',
    (alpha, beta, gamma, azimuth, altitude) => {
      const rotation = deviceOrientationToRotationMatrix({ alpha, beta, gamma })!
      expectVector(enuToDevice(azimuthAltitudeToEnu(azimuth, altitude), rotation), { x: 0, y: 0, z: -1 })
    },
  )

  it('北向きの縦持ちでは東が右、天頂が上、南が背後になる', () => {
    const rotation = deviceOrientationToRotationMatrix({ alpha: 0, beta: 90, gamma: 0 })!
    expectVector(enuToDevice(azimuthAltitudeToEnu(90, 0), rotation), { x: 1, y: 0, z: 0 })
    expectVector(enuToDevice(azimuthAltitudeToEnu(0, 90), rotation), { x: 0, y: 1, z: 0 })
    expectVector(enuToDevice(azimuthAltitudeToEnu(180, 0), rotation), { x: 0, y: 0, z: 1 })
  })

  it('背面方向が同じでも画面面内の回転を保持する', () => {
    const first = deviceOrientationToRotationMatrix({ alpha: 0, beta: 0, gamma: 0 })!
    const turned = deviceOrientationToRotationMatrix({ alpha: 90, beta: 0, gamma: 0 })!
    const down = azimuthAltitudeToEnu(0, -90)
    expectVector(enuToDevice(down, first), { x: 0, y: 0, z: -1 })
    expectVector(enuToDevice(down, turned), { x: 0, y: 0, z: -1 })
    expectVector(enuToDevice({ x: 1, y: 0, z: 0 }, turned), { x: 0, y: -1, z: 0 })
  })

  it.each([[42, 67, -31], [250, -120, 70]])(
    '複合姿勢(%s,%s,%s)は既存の背面方向と一致し、正規直交性を保つ', (alpha, beta, gamma) => {
      const rotation = deviceOrientationToRotationMatrix({ alpha, beta, gamma })!
      const view = getDeviceView({ alpha, beta, gamma, absolute: true, compassHeading: null })!
      expectVector(enuToDevice(azimuthAltitudeToEnu(view.azimuth, view.altitude), rotation), { x: 0, y: 0, z: -1 })
      const axes = [
        enuToDevice({ x: 1, y: 0, z: 0 }, rotation),
        enuToDevice({ x: 0, y: 1, z: 0 }, rotation),
        enuToDevice({ x: 0, y: 0, z: 1 }, rotation),
      ]
      axes.forEach((axis, i) => axes.forEach((other, j) => {
        expect(axis.x * other.x + axis.y * other.y + axis.z * other.z).toBeCloseTo(i === j ? 1 : 0, 10)
      }))
    },
  )

  it.each([
    { alpha: null, beta: 0, gamma: 0 },
    { alpha: 0, beta: null, gamma: 0 },
    { alpha: 0, beta: 0, gamma: null },
    { alpha: NaN, beta: 0, gamma: 0 },
    { alpha: 0, beta: Infinity, gamma: 0 },
    { alpha: 0, beta: 0, gamma: -Infinity },
  ])('欠測・非有限値はnullを返す (%j)', (orientation) => {
    expect(deviceOrientationToRotationMatrix(orientation)).toBeNull()
  })
})
