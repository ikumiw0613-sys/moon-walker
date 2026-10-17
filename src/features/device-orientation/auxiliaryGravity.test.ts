import { describe, expect, it, afterEach, vi } from 'vitest'
import type { MotionState } from '../device-motion/useDeviceMotion'
import { deviceOrientationToMatrix } from './deviceRotation'
import { getAuxiliaryGravity, getARGravityConvention } from './auxiliaryGravity'

const motion: MotionState = { status: 'active', updating: true, lastReceivedAt: 1000,
  accelerationIncludingGravity: { x: 0, y: -9.8, z: 0 }, filteredAcceleration: { x: 0, y: -9.8, z: 0 } }
const rotation = deviceOrientationToMatrix(0, 90, 0)
afterEach(() => vi.unstubAllGlobals())

describe('auxiliary gravity confidence (no fusion)', () => {
  it('修正済みiOSの反転なしDownを再利用する', () => {
    expect(getAuxiliaryGravity(motion, rotation, 1050, 'raw-is-down').angle).toBeCloseTo(0)
    expect(getAuxiliaryGravity(motion, rotation, 1050, 'raw-is-up').angle).toBeCloseTo(180)
    expect(rotation).toEqual(deviceOrientationToMatrix(0, 90, 0))
  })
  it('符号未確認、未取得、250msより古い値、不正値は信頼度に使わない', () => {
    expect(getAuxiliaryGravity(motion, rotation, 1050, null).angle).toBeNull()
    expect(getAuxiliaryGravity(motion, rotation, 1251, 'raw-is-down').angle).toBeNull()
    expect(getAuxiliaryGravity({ ...motion, updating: false }, rotation, 1050, 'raw-is-down').angle).toBeNull()
    expect(getAuxiliaryGravity({ ...motion, accelerationIncludingGravity: { x: NaN, y: 0, z: 0 } }, rotation, 1050, 'raw-is-down').angle).toBeNull()
    expect(getAuxiliaryGravity({ ...motion, filteredAcceleration: { x: 0, y: 0, z: 0 } }, rotation, 1050, 'raw-is-down').angle).toBeNull()
  })
  it('行列への一致度で符号を自動選択しない', () => {
    expect(getAuxiliaryGravity(motion, deviceOrientationToMatrix(0, -90, 0), 1050, 'raw-is-down').angle).toBeCloseTo(180)
  })
  it('正常な素早い持ち替えでフィルタが遅れている間は重力差を信頼度に使わない', () => {
    const settling = { ...motion, filteredAcceleration: { x: 0, y: 0, z: -9.8 } }
    const result = getAuxiliaryGravity(settling, rotation, 1050, 'raw-is-down')
    expect(result.angle).toBeNull()
    expect(result.reason).toContain('filter settling')
  })
  it('iOS WebKitの既知規約だけを使い、他環境は補助判定を省略する', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Safari' })
    expect(getARGravityConvention()).toBe('raw-is-down')
    vi.stubGlobal('navigator', { userAgent: 'Android AppleWebKit Chrome' })
    expect(getARGravityConvention()).toBeNull()
  })
})
