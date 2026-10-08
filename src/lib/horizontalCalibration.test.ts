import { getNorthReferencedDeviceRotation } from './northReferencedDevice'
import { describe, expect, it } from 'vitest'
import { captureNorthCalibration, getHorizontalCalibration, HORIZONTAL_CALIBRATION_THRESHOLD } from './horizontalCalibration'
import { applyNorthCorrection, deviceOrientationToMatrix, multiplyMatrixVector } from './vector3'
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

describe('calibrated rotation diagnostics', () => {
  it.each([[0, 0], [45, 90], [359, 1], [1, 359], [180, 0]])(
    'raw=%s°, compass=%s°で保存直後のheadingErrorは0°', (raw, compass) => {
      const rotation = deviceOrientationToMatrix(normalizeAzimuth(-raw), 90, 0)
      const saved = captureNorthCalibration(sample(raw, compass), 1000)!
      const result = getNorthReferencedDeviceRotation(rotation, saved.northCorrection, compass)
      expect(result.correctedHeading).toBeCloseTo(compass)
      expect(result.headingError).toBeCloseTo(0)
    },
  )

  it('行列全体を世界Z軸まわりに左から回し、入力と傾きを保持する', () => {
    const rotation = deviceOrientationToMatrix(315, 80, 20)
    const original = rotation.map((row) => [...row])
    const corrected = applyNorthCorrection(rotation, -90)
    for (let column = 0; column < 3; column += 1) {
      expect(corrected[0][column]).toBeCloseTo(rotation[1][column])
      expect(corrected[1][column]).toBeCloseTo(-rotation[0][column])
      expect(corrected[2][column]).toBeCloseTo(rotation[2][column])
    }
    expect(rotation).toEqual(original)
    const measurement = getHorizontalCalibration({ alpha: 315, beta: 80, gamma: 20, webkitCompassHeading: 90 })
    const result = getNorthReferencedDeviceRotation(rotation, measurement.northCorrection, 90)
    expect(result.correctedHeading).toBeCloseTo(90)
    expect(result.headingError).toBeCloseTo(0)
    expect(result.cameraForwardCorrected?.z).toBeCloseTo(measurement.cameraForwardRaw!.z)
  })

  it.each([[359, 1, -2], [1, 359, 2]])('headingErrorは境界でも最短差となる', (heading, compass, error) => {
    const result = getNorthReferencedDeviceRotation(deviceOrientationToMatrix(-heading, 90, 0), 0, compass)
    expect(result.headingError).toBeCloseTo(error)
  })

  it('未保存や未取得では補正後を生成しない', () => {
    const rotation = deviceOrientationToMatrix(0, 90, 0)
    for (const result of [getNorthReferencedDeviceRotation(rotation, null, 0), getNorthReferencedDeviceRotation(null, 0, 0)]) {
      expect(result.correctedRotation).toBeNull()
      expect(result.cameraForwardCorrected).toBeNull()
      expect(result.correctedHeading).toBeNull()
      expect(result.headingError).toBeNull()
    }
    expect(getNorthReferencedDeviceRotation(rotation, 0, null).headingError).toBeNull()
  })

  it('真上・真下では補正行列を保持し、方位と誤差を未確定にする', () => {
    const result = getNorthReferencedDeviceRotation(deviceOrientationToMatrix(0, 0, 0), -45, 90)
    expect(result.correctedRotation).not.toBeNull()
    expect(result.correctedHeading).toBeNull()
    expect(result.headingError).toBeNull()
  })
})
