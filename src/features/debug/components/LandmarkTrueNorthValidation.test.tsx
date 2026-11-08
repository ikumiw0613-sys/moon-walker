import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { getLandmarkTrueNorthDiagnostics } from '../landmarkTrueNorthDiagnostics'
import { getDebugMagneticDeclination } from '../magneticDeclination'
import { YOMIURILAND_REFERENCE } from '../landmarks'
import { LandmarkTrueNorthValidation } from './LandmarkTrueNorthValidation'

const date = new Date('2026-11-08T00:00:00Z')
const location = { latitude: YOMIURILAND_REFERENCE.latitude - 0.01,
  longitude: YOMIURILAND_REFERENCE.longitude, accuracy: 10, timestamp: date.getTime() }
const input = { state: { status: 'success' as const, location }, heading: 7.5, accuracy: -1,
  correctedHeading: 0.3, magnetic: { ...getDebugMagneticDeclination(location, date), magneticDeclination: -7.5 }, timestamp: date.getTime() }

it('shows raw and corrected comparisons, signed WMM metadata and hypothesis without applying correction', () => {
  const data = getLandmarkTrueNorthDiagnostics(input)
  const html = renderToStaticMarkup(<LandmarkTrueNorthValidation data={data} />)
  for (const text of ['Landmark / True North Validation', YOMIURILAND_REFERENCE.name, 'True bearing',
    'webkitCompassHeading', 'Difference', 'Absolute difference', 'webkitCompassAccuracy', 'correctedHeading',
    'Magnetic residual', 'Model name', 'WMM-2025', 'Model epoch', 'Model date', 'Model unavailable reason',
    '+7.5°', '-7.5°', '-1.0°', 'MAGNETIC-NORTH-LIKE', '1.11 km', '精度情報は無効',
    'スマホ背面', '測量済みの軸中心ではなく', '適用しません']) expect(html).toContain(text)
  expect(data.webkitCompassHeading).toBe(7.5)
  expect(data.correctedHeading).toBe(0.3)
})

it('shows reasons instead of numeric placeholders for missing data', () => {
  const data = getLandmarkTrueNorthDiagnostics({ ...input, state: { status: 'idle' }, heading: null,
    correctedHeading: null, accuracy: undefined, magnetic: getDebugMagneticDeclination(null, date) })
  const html = renderToStaticMarkup(<LandmarkTrueNorthValidation data={data} />)
  expect(html).toContain('現在地を取得してください。')
  expect(html).toContain('INCONCLUSIVE')
  expect(html).not.toContain('NaN')
})

it('makes too-close GPS warning visible even when detailed coordinates are collapsed', () => {
  const data = getLandmarkTrueNorthDiagnostics({ ...input, state: { status: 'success', location: {
    ...location, latitude: YOMIURILAND_REFERENCE.latitude - 0.0001,
  } } })
  const html = renderToStaticMarkup(<LandmarkTrueNorthValidation data={data} />)
  expect(html).toContain('50m未満のため仮判定を停止')
  expect(html).toContain('GPS誤差の影響を受けやすい')
})
