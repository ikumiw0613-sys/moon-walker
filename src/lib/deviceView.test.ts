import { describe, expect, it } from 'vitest'
import { getDeviceView, normalizeAzimuth } from './deviceView'

const orientation = { alpha: 0, beta: 90, gamma: 0, absolute: true, compassHeading: null }

describe('getDeviceView', () => {
  it.each([[0, 0], [90, 270], [180, 180], [270, 90]])('縦持ちでalpha %sを方位角%sに変換する', (alpha, azimuth) => {
    const view = getDeviceView({ ...orientation, alpha })
    expect(view?.azimuth).toBeCloseTo(azimuth)
    expect(view?.altitude).toBeCloseTo(0)
  })

  it.each([[60, -30], [120, 30]])('beta %sを高度%sに変換する', (beta, altitude) => {
    expect(getDeviceView({ ...orientation, beta })?.altitude).toBeCloseTo(altitude)
  })

  it('横持ちでも端末の裏側の方向を使う', () => {
    const view = getDeviceView({ ...orientation, beta: 0, gamma: -90 })
    expect(view?.azimuth).toBeCloseTo(90)
    expect(view?.altitude).toBeCloseTo(0)
  })

  it('iPhoneのコンパス方位を反映する', () => {
    expect(getDeviceView({ ...orientation, alpha: 42, compassHeading: 123 })?.azimuth).toBeCloseTo(123)
  })

  it('傾いた端末でもコンパス方位を反映する', () => {
    expect(getDeviceView({ ...orientation, alpha: 42, beta: 60, compassHeading: 123 })?.azimuth).toBeCloseTo(123)
  })

  it('未取得の値・非有限値・真上や真下は方位未確定として扱う', () => {
    expect(getDeviceView({ ...orientation, alpha: null })).toBeNull()
    expect(getDeviceView({ ...orientation, beta: NaN })).toBeNull()
    expect(getDeviceView({ ...orientation, beta: 0 })).toBeNull()
    expect(getDeviceView({ ...orientation, beta: 180 })).toBeNull()
  })

  it('手動の北補正を0〜360度に正規化できる', () => {
    const north = getDeviceView({ ...orientation, alpha: 350 })!
    const turned = getDeviceView({ ...orientation, alpha: 330 })!
    expect(normalizeAzimuth(turned.azimuth - north.azimuth)).toBeCloseTo(20)
    expect(normalizeAzimuth(-20)).toBe(340)
  })
})
