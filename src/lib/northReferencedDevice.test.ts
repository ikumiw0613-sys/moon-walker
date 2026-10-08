import { describe, expect, it } from 'vitest'
import { getMoonDeviceState } from './moonDeviceNavigation'
import { getHorizontalCalibration, captureNorthCalibration } from './horizontalCalibration'
import { getCameraView, getNorthReferencedDeviceRotation } from './northReferencedDevice'
import { deviceOrientationToMatrix, moonDirectionToVector, multiplyMatrixVector } from './vector3'

const moon = (azimuth: number, altitude = 0) => ({ azimuth, altitude, isAboveHorizon: altitude > 0 })

// These fixtures fix both the ENU convention and the correction sign independently of page rendering.
describe('north-referenced celestial device state', () => {
  it.each([0, 90, 180, 270])('保存済み補正で方位%s°の月が背面カメラ正面になる', (heading) => {
    const orientation = { alpha: 315, beta: 90, gamma: 0 }
    const sample = getHorizontalCalibration({ ...orientation, webkitCompassHeading: heading })
    const saved = captureNorthCalibration(sample, 1234)!
    const result = getMoonDeviceState(orientation, saved.northCorrection, moon(heading), heading)
    expect(result.correctedHeading).toBeCloseTo(heading)
    expect(result.cameraForwardCorrected!.x).toBeCloseTo(Math.sin(heading * Math.PI / 180))
    expect(result.cameraForwardCorrected!.y).toBeCloseTo(Math.cos(heading * Math.PI / 180))
    expect(result.moonInDevice!.x).toBeCloseTo(0)
    expect(result.moonInDevice!.y).toBeCloseTo(0)
    expect(result.moonInDevice!.z).toBeCloseTo(-1)
    expect(result.angleToMoon).toBeCloseTo(0)
    expect(result.navigation?.status).toBe('centered')
  })

  it.each([[359, 1, -2], [1, 359, 2], [0, 360, 0], [360, 0, 0]])(
    'raw=%s°, compass=%s°でも0/360°境界で一致する', (raw, heading, correction) => {
      const orientation = { alpha: -raw, beta: 90, gamma: 0 }
      const calibration = getHorizontalCalibration({ ...orientation, webkitCompassHeading: heading })
      expect(calibration.northCorrection).toBeCloseTo(correction)
      const result = getMoonDeviceState(orientation, calibration.northCorrection, moon(heading))
      expect(result.correctedHeading).toBeCloseTo(heading % 360)
      expect(result.angleToMoon).toBeCloseTo(0)
      expect(result.moonInDevice!.z).toBeCloseTo(-1)
    },
  )

  it('境界をまたぐ月までの距離は358°ではなく2°', () => {
    const result = getMoonDeviceState({ alpha: -359, beta: 90, gamma: 0 }, 0, moon(1))
    expect(result.correctedHeading).toBeCloseTo(359)
    expect(result.angleToMoon).toBeCloseTo(2)
  })

  it('太陽で確認済みの回転を維持し、ライブコンパスで二重補正しない', () => {
    const orientation = { alpha: 315, beta: 80, gamma: 20 }
    const calibration = getHorizontalCalibration({ ...orientation, webkitCompassHeading: 90 })
    const result = getMoonDeviceState(orientation, calibration.northCorrection, moon(130, 35), 90)
    const changedCompass = getMoonDeviceState(orientation, calibration.northCorrection, moon(130, 35), 270)
    expect(result.correctedHeading).toBeCloseTo(90)
    expect(changedCompass.correctedRotation).toEqual(result.correctedRotation)
    expect(changedCompass.correctedHeading).toEqual(result.correctedHeading)
    expect(changedCompass.moonInDevice).toEqual(result.moonInDevice)
    expect(changedCompass.angleToMoon).toEqual(result.angleToMoon)
    expect(result.cameraForwardCorrected!.z).toBeCloseTo(calibration.cameraForwardRaw!.z)
    // Round trip catches a transposition error or applying the correction a second time.
    const restored = multiplyMatrixVector(result.correctedRotation!, result.moonInDevice!)
    const expected = moonDirectionToVector(130, 35)
    for (const axis of ['x', 'y', 'z'] as const) expect(restored[axis]).toBeCloseTo(expected[axis])
    expect(result.angleToMoon).toBeCloseTo(Math.acos(
      expected.x * result.cameraForwardCorrected!.x + expected.y * result.cameraForwardCorrected!.y
      + expected.z * result.cameraForwardCorrected!.z,
    ) * 180 / Math.PI)
  })

  it('未保存・欠測・非有限値では補正結果を捏造しない', () => {
    const orientation = { alpha: 0, beta: 90, gamma: 0 }
    for (const result of [
      getMoonDeviceState(orientation, null, moon(0)),
      getMoonDeviceState(orientation, NaN, moon(0)),
      getMoonDeviceState({ ...orientation, alpha: null }, 0, moon(0)),
      getMoonDeviceState({ ...orientation, gamma: Infinity }, 0, moon(0)),
    ]) {
      expect(result.correctedHeading).toBeNull()
      expect(result.correctedRotation).toBeNull()
      expect(result.moonInDevice).toBeNull()
      expect(result.angleToMoon).toBeNull()
    }
    expect(getMoonDeviceState(orientation, 0, moon(NaN)).moonInDevice).toBeNull()
  })

  it('真上・真下では方位のみ未確定とし、3Dの回転・月までの角度を保持する', () => {
    const result = getMoonDeviceState({ alpha: 0, beta: 0, gamma: 0 }, 0, moon(0, -90))
    expect(result.correctedHeading).toBeNull()
    expect(result.correctedView).toBeNull()
    expect(result.correctedRotation).not.toBeNull()
    expect(result.angleToMoon).toBeCloseTo(0)
    expect(getCameraView({ x: NaN, y: 1, z: 0 })).toBeNull()
    expect(getNorthReferencedDeviceRotation(deviceOrientationToMatrix(0, 90, 0), null).correctedRotation).toBeNull()
  })
})
