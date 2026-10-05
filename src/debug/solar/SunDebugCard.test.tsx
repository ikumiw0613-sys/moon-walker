import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SunDebugCard } from './SunDebugCard'
import { getSunPosition } from './sunPosition'

afterEach(() => vi.useRealTimers())
const location = { latitude: 35.6812, longitude: 139.7671, accuracy: 10, timestamp: 0 }

describe('SunDebugCard', () => {
  it('位置未取得では案内を表示する', () => {
    expect(renderToStaticMarkup(<SunDebugCard state={{ status: 'idle' }} correctedHeading={null} />)).toContain('現在地を取得してください')
  })

  it('現在時刻の太陽と補正済み方位を比較する', () => {
    vi.useFakeTimers()
    const date = new Date('2026-10-05T12:00:00+09:00')
    vi.setSystemTime(date)
    const sun = getSunPosition(location.latitude, location.longitude, date)
    const html = renderToStaticMarkup(<SunDebugCard state={{ status: 'success', location }} correctedHeading={sun.azimuth} />)
    expect(html).toContain('かなり近い / 方位が一致しています')
    expect(html).toContain(`${sun.altitude.toFixed(1)}°`)
  })

  it('夜間は方位案内を表示しない', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-05T00:00:00+09:00'))
    const html = renderToStaticMarkup(<SunDebugCard state={{ status: 'success', location }} correctedHeading={120} />)
    expect(html).toContain('太陽は地平線の下にあります')
    expect(html).not.toContain('少し左へ')
    expect(html).not.toContain('少し右へ')
  })
})
