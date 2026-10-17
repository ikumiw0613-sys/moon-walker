import { describe, expect, it } from 'vitest'
import { deviceOrientationToMatrix } from './deviceRotation'
import { createPoseTracker, invalidatePose, updatePoseStability, rotationDistanceDegrees,
  POSE_RECOVERY_MS, GRAVITY_MISMATCH_MS } from './poseStability'
import type { PoseSample } from './poseStability'
import { getNorthReferencedDeviceRotation } from './northReferencedDevice'
import { cameraVectorToViewAngles } from '../sky/skyParallax'
import { getARConfidentGuidance } from '../moon-guide/arGuidanceConfidence'
import { getMoonDeviceState } from '../moon-guide/moonDeviceNavigation'
import { projectMoonToScreen } from '../moon-guide/moonProjection'

function sample(at: number, alpha = 0, beta = 90, gamma = 0, gravityDifference: number | null = null): PoseSample {
  const rotation = deviceOrientationToMatrix(alpha, beta, gamma)
  const camera = getNorthReferencedDeviceRotation(rotation, 0)
  return { at, rotation, heading: camera.correctedHeading,
    altitude: cameraVectorToViewAngles(camera.cameraForwardCorrected!).altitude, gravityDifference }
}
function start(value = sample(0)) {
  return updatePoseStability(createPoseTracker(true), value)
}

describe('pose stability without changing rotations', () => {
  it('359°→1°の最短角度差は2°でstable', () => {
    const result = updatePoseStability(start(sample(0, -359)), sample(16, -1))
    expect(result.headingDelta).toBeCloseTo(2)
    expect(result.status).toBe('stable')
  })
  it('小さい姿勢変化と素早い連続した動きを遅らせない', () => {
    let tracker = start()
    for (let i = 1; i <= 20; i++) {
      tracker = updatePoseStability(tracker, sample(i * 16, i * 8, 90 + i * 0.5, i))
      expect(tracker.status).toBe('stable')
    }
  })
  it.each([
    ['heading jump', sample(0), sample(16, 90)],
    ['altitude jump', sample(0), sample(16, 0, 135)],
    ['rotation jump', sample(0, 0, 0), sample(16, 90, 0)],
  ] as const)('%sを検出する', (reason, initial, current) => {
    const result = updatePoseStability(start(initial), current)
    expect(result.status).toBe('unstable')
    expect(result.reason).toBe(reason)
  })
  it('正常値が350msかつ4サンプル以上続けば復帰する', () => {
    let tracker = updatePoseStability(start(), sample(16, 90))
    for (let i = 1; i <= 30; i++) tracker = updatePoseStability(tracker, sample(16 + i * 16, 90))
    expect(tracker.status).toBe('stable')
    expect(tracker.reason).toBe('normal updates')
    expect(tracker.recoverySamples).toBeGreaterThanOrEqual(4)
    expect(tracker.previous!.at - tracker.recoverySince!).toBeGreaterThanOrEqual(POSE_RECOVERY_MS)
  })
  it('復帰中の再ジャンプで復帰待ちをやり直す', () => {
    let tracker = updatePoseStability(start(), sample(16, 90))
    tracker = updatePoseStability(tracker, sample(32, 90))
    tracker = updatePoseStability(tracker, sample(48, 0))
    expect(tracker.status).toBe('unstable')
    expect(tracker.recoverySince).toBeNull()
  })
  it('重複timestampは正常サンプル数を増やさない', () => {
    const tracker = updatePoseStability(start(), sample(16, 90))
    expect(updatePoseStability(tracker, sample(16, 90))).toBe(tracker)
  })
  it('天頂付近のheading反転は小さい3D変化なら急変扱いしない', () => {
    const result = updatePoseStability(start(sample(0, 0, 179)), sample(16, 0, 181))
    expect(Math.abs(result.headingDelta!)).toBeCloseTo(180)
    expect(result.rotationDelta).toBeCloseTo(2)
    expect(result.status).toBe('stable')
  })
  it('250msの更新途切れを検出し、無効姿勢はunavailable', () => {
    expect(updatePoseStability(start(), sample(300)).reason).toBe('orientation update gap')
    expect(updatePoseStability(start(), { ...sample(16), altitude: NaN }).status).toBe('unavailable')
    expect(invalidatePose(start(), 'stopped').previous).toBeNull()
  })
  it('大きい重力差は700ms継続時のみunstable、短い持ち替えは通常扱い', () => {
    let tracker = start(sample(0, 0, 90, 0, 45))
    for (let at = 50; at < GRAVITY_MISMATCH_MS; at += 50) {
      tracker = updatePoseStability(tracker, sample(at, 0, 90, 0, 45))
      expect(tracker.status).toBe('stable')
    }
    tracker = updatePoseStability(tracker, sample(GRAVITY_MISMATCH_MS, 0, 90, 0, 45))
    expect(tracker.reason).toBe('gravity mismatch')
    expect(tracker.status).toBe('unstable')
    for (let at = 750; at <= 1200; at += 50) tracker = updatePoseStability(tracker, sample(at, 0, 90, 0, 2))
    expect(tracker.status).toBe('stable')
  })
  it('未取得・非有限・途切れた重力差は姿勢更新だけで扱う', () => {
    let tracker = start(sample(0, 0, 90, 0, 45))
    for (let at = 100; at <= 1000; at += 100) tracker = updatePoseStability(tracker, sample(at, 0, 90, 0, at === 300 ? NaN : null))
    expect(tracker.status).toBe('stable')
    expect(tracker.gravityMismatchSince).toBeNull()
  })
  it('不安定時はcentered/near/案内を抑えるが、座標・投影は変更しない', () => {
    const moon = { azimuth: 0, altitude: 0, isAboveHorizon: true }
    const state = getMoonDeviceState({ alpha: 0, beta: 90, gamma: 0 }, 0, moon)
    const before = JSON.stringify(state)
    const projected = projectMoonToScreen(state.moonInDevice!)
    for (const status of ['unstable', 'unavailable'] as const) {
      expect(getARConfidentGuidance(state.navigation, { status }, false)).toEqual({ guidance: null, isNear: false, isCentered: false })
    }
    expect(getARConfidentGuidance(state.navigation, { status: 'stable' }, false).isCentered).toBe(true)
    expect(getARConfidentGuidance(state.navigation, { status: 'stable' }, true).guidance).toBeNull()
    expect(JSON.stringify(state)).toBe(before)
    expect(projectMoonToScreen(state.moonInDevice!)).toEqual(projected)
  })
  it('SO(3)距離はEuler表現の違いに依存せずロールも検出する', () => {
    const a = deviceOrientationToMatrix(0, 90, 0)
    const b = deviceOrientationToMatrix(360, 90, 0)
    expect(rotationDistanceDegrees(a, b)).toBeCloseTo(0)
    expect(rotationDistanceDegrees(a, deviceOrientationToMatrix(0, 90, 60))).toBeCloseTo(60)
  })
})
