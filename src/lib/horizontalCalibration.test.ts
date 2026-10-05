import { describe, expect, it } from 'vitest'
import { captureNorthCalibration, getHorizontalCalibration, HORIZONTAL_CALIBRATION_THRESHOLD } from './horizontalCalibration'
import { deviceOrientationToMatrix, multiplyMatrixVector } from './vector3'
import { normalizeAzimuth } from './deviceView'

const sample = (rawHeading: number, compassHeading: number | null = rawHeading, beta = 90) =>
  getHorizontalCalibration({ alpha: normalizeAzimuth(-rawHeading), beta, gamma: 0, webkitCompassHeading: compassHeading })

describe('horizontal north calibration', () => {
  it('北向きのrawとcompassが一致すると補正角は0°', () => {
    const result = sample(0)
    expect(result.cameraForwardRaw?.y).toBeCloseTo(1)
    expect(result.horizontalLength).toBeCloseTo(1)
    expect(result.rawHeading).toBeCloseTo(0)
    expect(result.northCorrection).toBeCloseTo(0)
    expect(result.canCalibrate).toBe(true)
  })

  it('raw=45°, compass=90°は-45°で、既存行列の正回転によって東に一致する', () => {
    const result = sample(45, 90)
    expect(result.rawHeading).toBeCloseTo(45)
    expect(result.northCorrection).toBeCloseTo(-45)
    // With beta=gamma=0 this is the existing Rz convention, not a new rotation implementation.
    const corrected = multiplyMatrixVector(deviceOrientationToMatrix(result.northCorrection!, 0, 0), result.cameraForwardRaw!)
    expect(normalizeAzimuth(Math.atan2(corrected.x, corrected.y) * 180 / Math.PI)).toBeCloseTo(90)
  })

  it.each([[359, 1, -2], [1, 359, 2], [0, 360, 0], [360, 0, 0], [180, 0, -180]])(
    'raw=%s°, compass=%s°の境界を補正角%s°に正規化する', (raw, compass, expected) => {
      const result = sample(raw, compass)
      expect(result.rawHeading).toBeGreaterThanOrEqual(0)
      expect(result.rawHeading).toBeLessThan(360)
      expect(result.northCorrection).toBeCloseTo(expected)
    },
  )

  it('閾値未満は方位と補正角を確定しない', () => {
    const result = sample(0, 0, 60)
    expect(result.horizontalLength).toBeLessThan(HORIZONTAL_CALIBRATION_THRESHOLD)
    expect(result.rawHeading).toBeNull()
    expect(result.canCalibrate).toBe(false)
    expect(captureNorthCalibration(result, 1000)).toBeNull()
  })

  it('閾値の直上なら許可し、直下なら許可しない', () => {
    const beta = (length: number) => Math.asin(length) * 180 / Math.PI
    expect(sample(0, 0, beta(HORIZONTAL_CALIBRATION_THRESHOLD + 1e-6)).canCalibrate).toBe(true)
    expect(sample(0, 0, beta(HORIZONTAL_CALIBRATION_THRESHOLD - 1e-6)).canCalibrate).toBe(false)
  })

  it.each([null, undefined, NaN, Infinity, -1, 361])('compass=%sならキャリブレーション不可', (heading) => {
    const result = getHorizontalCalibration({ alpha: 0, beta: 90, gamma: 0, webkitCompassHeading: heading })
    expect(result.isHorizontal).toBe(true)
    expect(result.canCalibrate).toBe(false)
    expect(result.northCorrection).toBeNull()
    expect(captureNorthCalibration(result, 1000)).toBeNull()
  })

  it('欠測や非有限の姿勢を拒否する', () => {
    for (const input of [null, { alpha: null, beta: 90, gamma: 0 }, { alpha: NaN, beta: 90, gamma: 0 }]) {
      const result = getHorizontalCalibration(input)
      expect(result.cameraForwardRaw).toBeNull()
      expect(result.canCalibrate).toBe(false)
    }
  })

  it('押した時点の補正角と時刻を保存し、次の測定では変更しない', () => {
    const saved = captureNorthCalibration(sample(45, 90), 123456789)
    sample(120, 90)
    expect(saved).toEqual({ northCorrection: -45, calibratedAt: 123456789 })
    expect(captureNorthCalibration(sample(120, 90), 123456790)).toEqual({ northCorrection: 30, calibratedAt: 123456790 })
  })
})
