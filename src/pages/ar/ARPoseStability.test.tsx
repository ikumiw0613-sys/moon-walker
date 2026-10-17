// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ARPage } from './ARPage'
import { getMoonDeviceState } from '../../features/moon-guide/moonDeviceNavigation'
import type { MotionState } from '../../features/device-motion/useDeviceMotion'

const mocks = vi.hoisted(() => ({
  orientation: { alpha: 0, beta: 90, gamma: 0, status: 'active', compassHeading: 0, message: '取得中' },
  sampleId: 0,
  correction: 0,
  motion: { status: 'idle', updating: false, lastReceivedAt: null, accelerationIncludingGravity: null,
    filteredAcceleration: null } as MotionState,
  requestMotion: vi.fn(),
}))
vi.mock('../../features/device-orientation/useDeviceOrientation', () => ({ useDeviceOrientation: () => ({
  state: mocks.orientation, requestPermission: vi.fn(), retryConnection: vi.fn(),
  diagnostics: { lastAccepted: { receivedAt: mocks.sampleId } },
}) }))
vi.mock('../../features/device-motion/useDeviceMotion', () => ({ useDeviceMotion: () => ({ state: mocks.motion, requestPermission: mocks.requestMotion }) }))
vi.mock('../../features/north-calibration/useNorthCalibration', () => ({ useNorthCalibration: () => ({ calibrated: true, northCorrection: mocks.correction }) }))
vi.mock('../../features/moon/astronomy', () => ({ getMoonPosition: () => ({ azimuth: 0, altitude: 0, isAboveHorizon: true }) }))

let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
const location = { status: 'success' as const, location: { latitude: 35, longitude: 139, accuracy: 10, timestamp: 0 } }
async function show() {
  await act(async () => root.render(<ARPage navigate={vi.fn()} state={location} requestLocation={vi.fn()} />))
}
async function send(alpha = mocks.orientation.alpha, step = 16) {
  await act(async () => vi.advanceTimersByTime(step))
  mocks.orientation.alpha = alpha
  mocks.sampleId += 1
  if (mocks.motion.updating) mocks.motion = { ...mocks.motion, lastReceivedAt: Date.now() }
  await show()
}
function main() { return container.querySelector('main')! }
function expectSuppressed() {
  expect(container.querySelector('.moon-sprite')).toBeNull()
  expect(container.querySelector('.mw-ar-ring')).toBeNull()
  expect(container.querySelector('.mw-ar-guide')).toBeNull()
  expect(container.querySelector('.mw-ar-moon-marker')).toBeNull()
  expect(container.textContent).toContain('向きを確認しています…')
}
beforeEach(async () => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Safari')
  mocks.orientation = { alpha: 0, beta: 90, gamma: 0, status: 'active', compassHeading: 0, message: '取得中' }
  mocks.sampleId = 0
  mocks.correction = 0
  mocks.motion = { status: 'idle', updating: false, lastReceivedAt: null, accelerationIncludingGravity: null, filteredAcceleration: null }
  mocks.requestMotion.mockClear()
  container = document.createElement('div')
  root = createRoot(container)
  await show()
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('AR pose confidence gate', () => {
  it('急変中は確定・near・案内を止め、元の姿勢で正常更新が続けば自動復帰', async () => {
    expect(container.textContent).toContain('このあたりに月があります')
    await send(90)
    expect(main().dataset.poseStability).toBe('unstable')
    expect(main().dataset.poseStabilityReason).toBe('heading jump')
    expectSuppressed()
    const raw = getMoonDeviceState(mocks.orientation, 0, { azimuth: 0, altitude: 0, isAboveHorizon: true })
    expect(JSON.parse(main().dataset.moonInDevice!)).toEqual(raw.moonInDevice)
    await send(0)
    for (let i = 0; i < 30; i++) await send(0)
    expect(main().dataset.poseStability).toBe('stable')
    expect(container.querySelector('.mw-ar-ring--centered')).not.toBeNull()
    expect(container.textContent).toContain('このあたりに月があります')
    expect(mocks.correction).toBe(0)
  })
  it('通常の素早い動きでは案内を止めず、359°境界も通過する', async () => {
    for (const alpha of [-1, -9, -17, -25, -33]) {
      await send(alpha)
      expect(main().dataset.poseStability).toBe('stable')
    }
    expect(container.querySelector('.mw-ar-guide')).not.toBeNull()
  })
  it('600msの更新停止では古い月位置で確定表示しない', async () => {
    await act(async () => vi.advanceTimersByTime(600))
    expect(main().dataset.poseStability).toBe('unavailable')
    expectSuppressed()
    for (let i = 0; i < 30; i++) await send(0)
    expect(main().dataset.poseStability).toBe('stable')
  })
  it('月・UI・Motionだけの再描画で姿勢の鮮度を延長しない', async () => {
    for (let i = 0; i < 3; i++) {
      await act(async () => vi.advanceTimersByTime(200))
      mocks.motion = { ...mocks.motion }
      await show()
    }
    expectSuppressed()
  })
  it('重力差は700ms継続時のみ弱め、正常な重力へ戻れば自動復帰', async () => {
    mocks.motion = { status: 'active', updating: true, lastReceivedAt: Date.now(),
      accelerationIncludingGravity: { x: 0, y: 0, z: 9.8 }, filteredAcceleration: { x: 0, y: 0, z: 9.8 } }
    for (let i = 0; i < 8; i++) await send(0, 50)
    expect(main().dataset.poseStability).toBe('stable')
    for (let i = 0; i < 8; i++) await send(0, 50)
    expect(main().dataset.poseStabilityReason).toBe('gravity mismatch')
    expectSuppressed()
    mocks.motion = { ...mocks.motion, accelerationIncludingGravity: { x: 0, y: -9.8, z: 0 }, filteredAcceleration: { x: 0, y: -9.8, z: 0 } }
    for (let i = 0; i < 10; i++) await send(0, 50)
    expect(main().dataset.poseStability).toBe('stable')
  })
  it('再キャリブレーションは新しい基準として扱い、変更自体をセンサー急変と判定しない', async () => {
    mocks.correction = 90
    await show()
    expect(main().dataset.poseStability).toBe('stable')
    expect(Number(main().dataset.correctedHeading)).toBeCloseTo(270)
  })
  it('補助Motionはユーザー操作から許可要求する', async () => {
    const button = [...container.querySelectorAll('button')].find(button => button.textContent === '動きの補助確認を有効にする')!
    await act(async () => button.click())
    expect(mocks.requestMotion).toHaveBeenCalledTimes(1)
  })
  it('バックグラウンド復帰時は古い姿勢で再開せず、新しい連続更新を確認する', async () => {
    let visibility: DocumentVisibilityState = 'hidden'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    expect(main().dataset.poseStability).toBe('unavailable')
    visibility = 'visible'
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    expectSuppressed()
    for (let i = 0; i < 30; i++) await send(0)
    expect(main().dataset.poseStability).toBe('stable')
  })
})
