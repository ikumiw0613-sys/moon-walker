// @vitest-environment jsdom
import { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { INITIAL_SNAPSHOTS, MAX_DIAGNOSTIC_SNAPSHOTS, snapshotReducer } from '../diagnosticSnapshots'
import type { DiagnosticSnapshot } from '../diagnosticSnapshots'
import { DiagnosticSnapshots } from './DiagnosticSnapshots'
import { getLandmarkTrueNorthDiagnostics } from '../landmarkTrueNorthDiagnostics'
import { getDebugMagneticDeclination } from '../magneticDeclination'
import { YOMIURILAND_REFERENCE } from '../landmarks'

const targetLocation = { latitude: YOMIURILAND_REFERENCE.latitude - 0.01,
  longitude: YOMIURILAND_REFERENCE.longitude, accuracy: 10, timestamp: 1000 }
const yomiurilandValidation = getLandmarkTrueNorthDiagnostics({
  state: { status: 'success', location: targetLocation }, heading: 7.5, accuracy: -1, correctedHeading: 1,
  magnetic: { ...getDebugMagneticDeclination(targetLocation, new Date('2026-10-18T10:00:00Z')), magneticDeclination: -7.5 }, timestamp: 1000,
})

const values: Omit<DiagnosticSnapshot, 'memo' | 'timestamp'> = {
  yomiurilandValidation,
  latitude: 35.68, longitude: 139.76, locationTimestamp: 1000,
  compassHeading: 228.4, compassAccuracy: 6, northCorrection: 134.9,
  referenceTarget: '東京スカイツリー', referenceBearing: 217.7, compassError: 10.7,
  correctedHeadingError: -117.7, webkitCompassAccuracy: 10, landmarkAccuracy: 'BAD', distanceToTarget: 12400,
  candidateMedian: 136.1, candidateRange: 1.5, headingRange: 2.4, gravityDifference: 3,
  correctedHeading: 100, correctedAltitude: 20, moonAzimuth: 120, moonAltitude: 30,
  quality: 'good', qualityReasons: ['北補正候補は安定'], candidateCount: 24, headingCount: 24,
  timeMode: 'current', observationTime: '2026-10-18T10:00:00.000Z', orientationSource: 'sensor',
}
let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-18T10:00:00Z'))
  container = document.createElement('div')
  root = createRoot(container)
  await show()
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
async function show(data = values) {
  await act(async () => root.render(<StrictMode><DiagnosticSnapshots values={data} /></StrictMode>))
}
async function click(text: string) {
  const button = [...container.querySelectorAll('button')].find(button => button.textContent === text)!
  await act(async () => button.click())
}
it('records the click time, optional memo and all comparison values, frozen across later updates', async () => {
  const memo = container.querySelector('input')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(memo, '開けた場所・月と一致')
    memo.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await click('現在の診断を記録')
  const card = container.querySelector('article')!
  const recorded = card.textContent
  expect(recorded).toContain('開けた場所・月と一致')
  expect(recorded).toContain('2026-10-18T10:00:00.000Z')
  for (const text of ['19:00:00', 'GOOD', '6.0°', '1.5°', '2.4°', '35.68000', '139.76000', '228.4°',
    '134.9°', '136.1° / 24', '3.0°', '100.0° / 20.0°', '120.0° / 30.0°', 'sensor / current', '北補正候補は安定']) expect(recorded).toContain(text)
  expect(memo.value).toBe('')
  for (const text of ['Landmark Accuracy: BAD', '東京スカイツリー', '217.7°', '+10.7°', '-117.7°', '10.0°', '12.40 km']) expect(recorded).toContain(text)
  for (const text of [YOMIURILAND_REFERENCE.name, 'MAGNETIC-NORTH-LIKE', '+7.5°', '-7.5°', '-1.0°',
    'WMM-2025', '2025', '35.6257422', '139.5167327', '1.11 km', '2026-10-18T10:00:00.000Z']) expect(recorded).toContain(text)
  await show({ ...values, compassAccuracy: 25, quality: 'poor', latitude: 40,
    yomiurilandValidation: { ...yomiurilandValidation, webkitCompassHeading: 80,
      magneticDeclination: -8, headingReferenceHypothesis: 'INCONCLUSIVE' },
    referenceBearing: 300, compassError: 1, correctedHeadingError: 1, landmarkAccuracy: 'GOOD' })
  expect(card.textContent).toBe(recorded)
  await click('現在の診断を記録')
  expect(container.querySelector('article')!.textContent).toContain('POOR')
})
it('retains ten newest records, never reuses IDs, and supports delete and clear', async () => {
  for (let i = 0; i < MAX_DIAGNOSTIC_SNAPSHOTS + 2; i++) await click('現在の診断を記録')
  expect(container.querySelectorAll('article')).toHaveLength(MAX_DIAGNOSTIC_SNAPSHOTS)
  expect(container.querySelector('article')!.getAttribute('aria-label')).toBe('記録 #12')
  expect(container.querySelector('[aria-label="記録 #1"]')).toBeNull()
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="記録 #12 を削除"]')!.click())
  expect(container.querySelectorAll('article')).toHaveLength(MAX_DIAGNOSTIC_SNAPSHOTS - 1)
  await click('記録をすべてクリア')
  expect(container.querySelectorAll('article')).toHaveLength(0)
  await click('現在の診断を記録')
  expect(container.querySelector('article')!.getAttribute('aria-label')).toBe('記録 #13')
})
it('allows recording UNAVAILABLE with missing values for diagnosing unsupported devices', async () => {
  await show({ ...values, quality: 'unavailable', compassAccuracy: null, candidateMedian: null, candidateRange: null,
    headingRange: null, qualityReasons: ['未対応'], candidateCount: 0, headingCount: 0 })
  await click('現在の診断を記録')
  expect(container.querySelector('article')!.textContent).toContain('UNAVAILABLE')
  expect(container.querySelector('article')!.textContent).toContain('未対応')
  expect(container.querySelector('article')!.textContent).not.toContain('NaN')
})

it('copies Yomiuriland values at capture time and uses the same click timestamp for both records', () => {
  const snapshot = { ...values, yomiurilandValidation: { ...yomiurilandValidation }, memo: '', timestamp: 123456789 }
  const saved = snapshotReducer(INITIAL_SNAPSHOTS, { type: 'add', snapshot }).items[0].yomiurilandValidation
  expect(saved).toEqual({ ...yomiurilandValidation, timestamp: snapshot.timestamp })
  snapshot.yomiurilandValidation.webkitCompassHeading = 180
  snapshot.yomiurilandValidation.magneticDeclination = 20
  expect(saved.webkitCompassHeading).toBe(7.5)
  expect(saved.magneticDeclination).toBe(-7.5)
})
