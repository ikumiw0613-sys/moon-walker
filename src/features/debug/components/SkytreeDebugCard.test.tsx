import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TOKYO_SKYTREE } from '../landmarks'
import { getLandmarkCompassDiagnostics } from '../landmarkCompassDiagnostics'
import { SkytreeDebugCard } from './SkytreeDebugCard'

const input = {
  state: { status: 'success' as const, location: { latitude: TOKYO_SKYTREE.latitude - 0.01,
    longitude: TOKYO_SKYTREE.longitude, accuracy: 10, timestamp: 0 } },
  compassHeading: 10.7, correctedHeading: 10.1, rawHeading: 25, webkitCompassAccuracy: 10,
}

describe('Skytree landmark validation card', () => {
  it('prompts for a location and displays unavailable instead of invented bearings', () => {
    const html = renderToStaticMarkup(<SkytreeDebugCard data={getLandmarkCompassDiagnostics({ ...input, state: { status: 'idle' } })} />)
    expect(html).toContain('現在地を取得してください')
    expect(html).toContain('UNAVAILABLE')
    expect(html).not.toContain('NaN')
  })

  it('prioritizes landmark accuracy, reference, real compass and signed errors before details', () => {
    const html = renderToStaticMarkup(<SkytreeDebugCard data={getLandmarkCompassDiagnostics(input)} />)
    const primary = html.split('<details')[0]
    for (const text of ['Landmark compass validation', 'Landmark Accuracy', 'BAD', 'Reference bearing',
      'webkitCompassHeading', '+10.7°', 'Absolute error', 'スマホの背面を東京スカイツリーへ']) expect(primary).toContain(text)
    for (const text of ['Current location latitude', 'Current location longitude', 'Target location latitude',
      'Target location longitude', 'Distance to target', 'Corrected heading', '+10.1°',
      'Raw heading', 'webkitCompassAccuracy', '10.0°', '安定していても']) expect(html).toContain(text)
  })

  it('validates uncalibrated real compass readings and explains too-close/unavailable cases', () => {
    const html = renderToStaticMarkup(<SkytreeDebugCard data={getLandmarkCompassDiagnostics({ ...input, correctedHeading: null })} />)
    expect(html).toContain('BAD')
    expect(html).toContain('Corrected heading</dt><dd>unavailable')
    const close = renderToStaticMarkup(<SkytreeDebugCard data={getLandmarkCompassDiagnostics({ ...input,
      state: { status: 'success', location: { ...input.state.location, ...TOKYO_SKYTREE } },
    })} />)
    expect(close).toContain('50m未満')
    expect(close).toContain('Reference bearing</dt><dd>unavailable')
  })
})
