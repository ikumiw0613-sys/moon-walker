// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NorthCalibrationProvider } from './NorthCalibrationProvider'
import { useNorthCalibration } from './useNorthCalibration'
import { RECALIBRATION_RECOMMEND_AFTER_MS } from './recalibrationPolicy'

let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
let screenOrientation: EventTarget & { angle: number }
function Probe() {
  const calibration = useNorthCalibration()
  return <>
    <button onClick={() => calibration.saveNorthCalibration({ northCorrection: 45, calibratedAt: Date.now() })}>save</button>
    <button onClick={() => calibration.saveNorthCalibration({ northCorrection: NaN, calibratedAt: Date.now() })}>invalid</button>
    <button onClick={calibration.dismissRecalibrationRecommendation}>dismiss</button>
    <button onClick={() => calibration.requireNorthRecalibration('sensor-source-changed')}>require</button>
    <output>{JSON.stringify(calibration)}</output>
  </>
}
const read = () => JSON.parse(container.querySelector('output')!.textContent!)
async function click(label: string) {
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === label)!.click())
}
async function advance(ms: number) { await act(async () => vi.advanceTimersByTime(ms)) }
beforeEach(async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-08T00:00:00Z'))
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  screenOrientation = Object.assign(new EventTarget(), { angle: 0 })
  vi.stubGlobal('screen', { orientation: screenOrientation })
  container = document.createElement('div')
  root = createRoot(container)
  await act(async () => root.render(<NorthCalibrationProvider><Probe /></NorthCalibrationProvider>))
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('recommends at exactly five minutes, preserving the correction and mandatory flag', async () => {
  expect(read().recalibrationRecommended).toBe(false)
  await click('save')
  const at = read().calibratedAt
  await advance(RECALIBRATION_RECOMMEND_AFTER_MS - 1)
  expect(read().recalibrationRecommended).toBe(false)
  await advance(1)
  expect(read()).toMatchObject({ northCorrection: 45, calibratedAt: at, calibrated: true,
    needsRecalibration: false, recalibrationRecommended: true,
    recalibrationRecommendationReasons: ['stale-calibration'] })
})

it('resets age, reasons and dismissal on a new calibration', async () => {
  await click('save')
  await advance(RECALIBRATION_RECOMMEND_AFTER_MS)
  await click('dismiss')
  await click('save')
  expect(read()).toMatchObject({ recalibrationRecommended: false, recalibrationRecommendationReasons: [], needsRecalibration: false })
  await advance(RECALIBRATION_RECOMMEND_AFTER_MS - 1)
  expect(read().recalibrationRecommended).toBe(false)
  await advance(1)
  expect(read().recalibrationRecommended).toBe(true)
})

it('does not reopen for the same dismissed reason, but a new reason can reopen the notice', async () => {
  await click('save')
  await act(async () => screenOrientation.dispatchEvent(new Event('change')))
  expect(read()).toMatchObject({ recalibrationRecommended: true, needsRecalibration: false,
    recalibrationRecommendationReasons: ['screen-orientation-changed'], northCorrection: 45 })
  await click('dismiss')
  await act(async () => window.dispatchEvent(new Event('orientationchange')))
  expect(read().recalibrationRecommended).toBe(false)
  await advance(RECALIBRATION_RECOMMEND_AFTER_MS)
  expect(read().recalibrationRecommended).toBe(true)
  expect(read().recalibrationRecommendationReasons).toEqual(['screen-orientation-changed', 'stale-calibration'])
})

it('keeps existing background invalidation mandatory and unclosable', async () => {
  let visibility: DocumentVisibilityState = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
  await click('save')
  await advance(RECALIBRATION_RECOMMEND_AFTER_MS)
  await act(async () => { visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')) })
  expect(read()).toMatchObject({ calibrated: false, northCorrection: null, needsRecalibration: true,
    requiredRecalibrationReason: 'resumed-from-background', recalibrationRecommended: false })
  await act(async () => { visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')) })
  await click('dismiss')
  expect(read().needsRecalibration).toBe(true)
  await click('save')
  expect(read()).toMatchObject({ calibrated: true, needsRecalibration: false, requiredRecalibrationReason: null, recalibrationRecommended: false })
})

it('does not confuse required reasons or invalid calibration with optional advice', async () => {
  await click('save')
  await click('require')
  expect(read()).toMatchObject({ needsRecalibration: true, requiredRecalibrationReason: 'sensor-source-changed', recalibrationRecommended: false })
  await click('save')
  await click('invalid')
  expect(read()).toMatchObject({ calibrated: false, needsRecalibration: true,
    requiredRecalibrationReason: 'invalid-calibration', recalibrationRecommended: false })
})

it('does not notify without a calibration, and cancels the age timer on unmount', async () => {
  await advance(RECALIBRATION_RECOMMEND_AFTER_MS * 2)
  await act(async () => window.dispatchEvent(new Event('orientationchange')))
  expect(read()).toMatchObject({ needsRecalibration: false, recalibrationRecommended: false })
  await click('save')
  expect(vi.getTimerCount()).toBe(1)
  await act(async () => root.unmount())
  expect(vi.getTimerCount()).toBe(0)
  root = createRoot(container)
})
