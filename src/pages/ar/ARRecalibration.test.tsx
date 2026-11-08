// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NorthCalibrationProvider } from '../../features/north-calibration/NorthCalibrationProvider'
import { useNorthCalibration } from '../../features/north-calibration/useNorthCalibration'
import { PROLONGED_POSE_INSTABILITY_MS, RECALIBRATION_RECOMMEND_AFTER_MS } from '../../features/north-calibration/recalibrationPolicy'
import { ARPage } from './ARPage'

const sensor = vi.hoisted(() => ({ alpha: 0, status: 'active', eventType: 'deviceorientation', absolute: false, pose: 'stable' }))
vi.mock('../../features/device-orientation/useDeviceOrientation', () => ({ useDeviceOrientation: () => ({
  state: { alpha: sensor.alpha, beta: 90, gamma: 0, compassHeading: 0, absolute: sensor.absolute, status: sensor.status, message: '取得中' },
  diagnostics: { lastAccepted: { eventType: sensor.eventType, absolute: sensor.absolute, receivedAt: Date.now() } },
  requestPermission: vi.fn(), retryConnection: vi.fn(),
}) }))
vi.mock('../../features/device-orientation/usePoseStability', () => ({ usePoseStability: () => ({
  status: sensor.pose, reason: 'test pose', headingDelta: null, altitudeDelta: null, rotationDelta: null,
  intervalMs: null, gravityDifference: null, gravityReason: null,
}) }))
vi.mock('../../features/moon/astronomy', () => ({ getMoonPosition: () => ({ azimuth: 0, altitude: 0, isAboveHorizon: true }) }))

let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
const navigate = vi.fn()
const location = { status: 'success' as const, location: { latitude: 35, longitude: 139, accuracy: 10, timestamp: 0 } }
function Flow({ showAR }: { showAR: boolean }) {
  const calibration = useNorthCalibration()
  return <>
    <button onClick={() => calibration.saveNorthCalibration({ northCorrection: 0, calibratedAt: Date.now() })}>test save</button>
    <output>{JSON.stringify(calibration)}</output>
    {showAR && <ARPage navigate={navigate} state={location} requestLocation={vi.fn()} />}
  </>
}
async function show(showAR = true) {
  await act(async () => root.render(<NorthCalibrationProvider><Flow showAR={showAR} /></NorthCalibrationProvider>))
}
async function save() {
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'test save')!.click())
}
async function advance(ms: number) { await act(async () => vi.advanceTimersByTime(ms)) }
const read = () => JSON.parse(container.querySelector('output')!.textContent!)
const notice = () => container.querySelector<HTMLElement>('[aria-label="向きの再調整"]')
async function dismiss() { await act(async () => notice()!.querySelector<HTMLButtonElement>('button')!.click()) }
function geometry() {
  const main = container.querySelector('main')!
  const sprite = container.querySelector<HTMLElement>('.moon-sprite')!
  return [main.dataset.correctedRotation, main.dataset.moonInDevice, main.dataset.correctedHeading,
    main.dataset.angleToMoon, sprite.style.left, sprite.style.top]
}
beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-08T00:00:00Z'))
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  Object.assign(sensor, { alpha: 0, status: 'active', eventType: 'deviceorientation', absolute: false, pose: 'stable' })
  navigate.mockClear()
  container = document.createElement('div')
  root = createRoot(container)
  await show()
  await save()
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('adds age advice inline without hiding centered guidance, changing geometry or navigating', async () => {
  expect(notice()).toBeNull()
  const before = geometry()
  await advance(RECALIBRATION_RECOMMEND_AFTER_MS - 1)
  expect(notice()).toBeNull()
  await advance(1)
  expect(notice()!.textContent).toContain('しばらく使用しています')
  expect(container.querySelector('.mw-ar-guide')!.contains(notice())).toBe(true)
  expect(container.querySelector('.mw-ar-ring--centered')).not.toBeNull()
  expect(container.textContent).toContain('このあたりに月があります')
  expect(geometry()).toEqual(before)
  expect(read().needsRecalibration).toBe(false)
  expect(navigate).not.toHaveBeenCalled()
  const link = notice()!.querySelector<HTMLAnchorElement>('a')!
  expect(link.getAttribute('href')).toBe('/calibration')
  await act(async () => link.click())
  expect(navigate).toHaveBeenCalledWith('/calibration')
})

it('keeps dismissal across AR visits and reopens only for a new reason or a new calibration', async () => {
  await advance(RECALIBRATION_RECOMMEND_AFTER_MS)
  await dismiss()
  await show(false)
  await show()
  await advance(RECALIBRATION_RECOMMEND_AFTER_MS)
  expect(notice()).toBeNull()
  await act(async () => window.dispatchEvent(new Event('orientationchange')))
  expect(notice()!.dataset.recalibrationReasons).toContain('screen-orientation-changed')
  await dismiss()
  await act(async () => window.dispatchEvent(new Event('orientationchange')))
  expect(notice()).toBeNull()
  await save()
  expect(read().recalibrationRecommendationReasons).toEqual([])
  expect(notice()).toBeNull()
  await advance(RECALIBRATION_RECOMMEND_AFTER_MS)
  expect(notice()).not.toBeNull()
})

it('treats a screen change as optional and retains the saved correction and AR guidance', async () => {
  const before = geometry()
  await act(async () => window.dispatchEvent(new Event('orientationchange')))
  expect(read()).toMatchObject({ calibrated: true, needsRecalibration: false, recalibrationRecommended: true, northCorrection: 0 })
  expect(geometry()).toEqual(before)
  expect(navigate).not.toHaveBeenCalled()
})

it('recommends after 15 continuous unstable seconds and retains the advice after pose recovery', async () => {
  sensor.pose = 'unstable'
  await show()
  await advance(PROLONGED_POSE_INSTABILITY_MS - 1)
  expect(notice()).toBeNull()
  await advance(1)
  expect(notice()!.dataset.recalibrationReasons).toBe('prolonged-instability')
  expect(read().needsRecalibration).toBe(false)
  sensor.pose = 'stable'
  await show()
  expect(container.querySelector('.mw-ar-ring--centered')).not.toBeNull()
  expect(notice()).not.toBeNull()
})

it('does not add up short unstable intervals or call ordinary heading changes drift', async () => {
  for (let i = 0; i < 2; i++) {
    sensor.pose = 'unstable'
    await show()
    await advance(10_000)
    sensor.pose = 'stable'
    sensor.alpha += 1
    await show()
    await advance(1000)
  }
  expect(notice()).toBeNull()
  expect(read().needsRecalibration).toBe(false)
})

it('preserves mandatory background handling instead of replacing it with a dismissible banner', async () => {
  let visibility: DocumentVisibilityState = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
  await advance(RECALIBRATION_RECOMMEND_AFTER_MS)
  await act(async () => { visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')) })
  await act(async () => { visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')) })
  expect(notice()).toBeNull()
  expect(read()).toMatchObject({ needsRecalibration: true, requiredRecalibrationReason: 'resumed-from-background', northCorrection: null })
  expect(container.textContent).toContain('バックグラウンドから復帰したため')
  expect(container.querySelector('.mw-ar-guide')).toBeNull()
  expect(navigate).not.toHaveBeenCalled()
  await save()
  expect(read().needsRecalibration).toBe(false)
  expect(container.querySelector('.mw-ar-ring--centered')).not.toBeNull()
})

it('requires recalibration after an unavailable sensor recovers, but not for initial waiting', async () => {
  sensor.status = 'waiting'
  await show()
  sensor.status = 'active'
  await show()
  expect(read().needsRecalibration).toBe(false)
  sensor.status = 'unavailable'
  await show()
  sensor.status = 'waiting'
  await show()
  sensor.status = 'active'
  await show()
  expect(read()).toMatchObject({ needsRecalibration: true, requiredRecalibrationReason: 'orientation-recovered', recalibrationRecommended: false })
  expect(container.textContent).toContain('向きセンサーが停止後に復帰しました')
  expect(notice()).toBeNull()
  expect(navigate).not.toHaveBeenCalled()
})

it('requires recalibration when accepted sensor source changes and resets that baseline after saving', async () => {
  sensor.eventType = 'deviceorientationabsolute'
  sensor.absolute = true
  await show()
  expect(read()).toMatchObject({ needsRecalibration: true, requiredRecalibrationReason: 'sensor-source-changed' })
  expect(container.textContent).toContain('取得元が変わりました')
  await advance(1)
  await save()
  await show()
  expect(read()).toMatchObject({ needsRecalibration: false, recalibrationRecommended: false })
  expect(container.querySelector('.moon-sprite')).not.toBeNull()
})
