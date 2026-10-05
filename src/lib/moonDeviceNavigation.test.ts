import { describe, expect, it } from 'vitest'
import { getMoonDeviceNavigation, getMoonInDevice } from './moonDeviceNavigation'
import { deviceOrientationToMatrix } from './vector3'

describe('moon device guidance', () => {
  it.each([
    [0, 0, -1, '月はここ！', 0],
    [1, 0, -1, '右へ', 45], [-1, 0, -1, '左へ', 45],
    [0, 1, -1, '上へ', 45], [0, -1, -1, '下へ', 45],
    [0, 0, 1, '反対方向を向いてください', 180],
    [1, 0, 0, '反対方向を向いてください', 90],
    [1, 2, -1, '上へ', Math.acos(1 / Math.sqrt(6)) * 180 / Math.PI],
    [0, 0, -10, '月はここ！', 0],
  ])('(%s,%s,%s) gives %s at %s degrees', (x, y, z, message, angle) => {
    const result = getMoonDeviceNavigation({ x, y, z })!
    expect(result.message).toBe(message)
    expect(result.angleToMoon).toBeCloseTo(angle)
  })
  it('uses a five degree center threshold', () => {
    for (const angle of [4.99, 5.01]) {
      const radians = angle * Math.PI / 180
      expect(getMoonDeviceNavigation({ x: Math.sin(radians), y: 0, z: -Math.cos(radians) })?.status)
        .toBe(angle < 5 ? 'centered' : 'guiding')
    }
  })
  it('ignores invalid vectors', () => {
    expect(getMoonDeviceNavigation({ x: 0, y: 0, z: 0 })).toBeNull()
    expect(getMoonDeviceNavigation({ x: NaN, y: 0, z: -1 })).toBeNull()
  })
  it('applies north correction before transposing world to device', () => {
    const rotation = deviceOrientationToMatrix(0, 90, 0)
    const moon = { azimuth: 90, altitude: 0, isAboveHorizon: false }
    expect(getMoonDeviceNavigation(getMoonInDevice(moon, rotation, 0))?.angleToMoon).toBeCloseTo(90)
    const corrected = getMoonInDevice(moon, rotation, -90)
    expect(corrected.x).toBeCloseTo(0)
    expect(corrected.y).toBeCloseTo(0)
    expect(corrected.z).toBeCloseTo(-1)
    expect(getMoonDeviceNavigation(corrected)?.status).toBe('centered')
  })
})
