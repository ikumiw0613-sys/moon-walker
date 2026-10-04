import { describe, expect, it } from 'vitest'
import { getMoonNavigation, CENTER_AZIMUTH_THRESHOLD, CENTER_ALTITUDE_THRESHOLD } from './moonNavigation'

describe('getMoonNavigation', () => {
  it.each([
    [110, 30, '右へ'],
    [90, 30, '左へ'],
    [100, 40, '上へ'],
    [100, 20, '下へ'],
    [110, 40, '右上へ'],
    [110, 20, '右下へ'],
    [90, 40, '左上へ'],
    [90, 20, '左下へ'],
  ])('月の方位角 %s・高度 %s の案内は %s', (azimuth, altitude, message) => {
    expect(getMoonNavigation(
      { azimuth, altitude, isAboveHorizon: true },
      { azimuth: 100, altitude: 30 },
    )).toEqual({ status: 'guiding', message })
  })

  it.each([
    [10, 350, '右へ'],
    [350, 10, '左へ'],
  ])('0度の境界をまたぐ月 %s・視点 %s は %s', (azimuth, viewAzimuth, message) => {
    expect(getMoonNavigation(
      { azimuth, altitude: 30, isAboveHorizon: true },
      { azimuth: viewAzimuth, altitude: 30 },
    )).toEqual({ status: 'guiding', message })
  })

  it.each([-1, 1])('両軸とも閾値以内なら、境界を含めて中央と判定する (%s)', (sign) => {
    expect(getMoonNavigation(
      { azimuth: 100 + sign * CENTER_AZIMUTH_THRESHOLD, altitude: 30 + sign * CENTER_ALTITUDE_THRESHOLD, isAboveHorizon: true },
      { azimuth: 100, altitude: 30 },
    )).toEqual({ status: 'centered', message: '月はここ！' })
  })

  it('0度の境界をまたいでも中央付近を判定できる', () => {
    expect(getMoonNavigation(
      { azimuth: 2, altitude: 30, isAboveHorizon: true },
      { azimuth: 358, altitude: 30 },
    ).status).toBe('centered')
  })

  it.each([
    [100 + CENTER_AZIMUTH_THRESHOLD + 0.01, 30, '右へ'],
    [100, 30 + CENTER_ALTITUDE_THRESHOLD + 0.01, '上へ'],
  ])('片方の軸だけ閾値を超えても案内を続ける (%s, %s)', (azimuth, altitude, message) => {
    expect(getMoonNavigation(
      { azimuth, altitude, isAboveHorizon: true },
      { azimuth: 100, altitude: 30 },
    )).toEqual({ status: 'guiding', message })
  })

  it.each([
    [100, -10],
    [0, 90],
  ])('月が地平線より下なら視点 (%s, %s) に関係なく案内を止める', (azimuth, altitude) => {
    expect(getMoonNavigation(
      { azimuth: 100, altitude: -10, isAboveHorizon: false },
      { azimuth, altitude },
    )).toEqual({ status: 'below-horizon', message: '現在、月は地平線の下にあります' })
  })
})
