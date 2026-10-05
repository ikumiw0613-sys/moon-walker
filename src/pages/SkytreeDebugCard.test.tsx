import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TOKYO_SKYTREE } from '../constants/landmarks'
import { SkytreeDebugCard } from './SkytreeDebugCard'

describe('Skytree debug card', () => {
  it('未取得時は比較せず現在地の取得を促す', () => {
    const html = renderToStaticMarkup(<SkytreeDebugCard state={{ status: 'idle' }} correctedHeading={null} />)
    expect(html).toContain('現在地を取得してください')
    expect(html).not.toContain('かなり近い /')
  })

  it('取得済みでも未校正なら方位と距離のみ表示する', () => {
    const html = renderToStaticMarkup(<SkytreeDebugCard state={{ status: 'success', location: { latitude: 35.68, longitude: 139.76, accuracy: 10, timestamp: 0 } }} correctedHeading={null} />)
    expect(html).toContain('35.6800000 / 139.7600000')
    expect(html).toContain('北補正をキャリブレーションして')
    expect(html).toContain('km')
  })

  it('一致する実機方位を評価して表示する', () => {
    const html = renderToStaticMarkup(<SkytreeDebugCard state={{ status: 'success', location: { latitude: TOKYO_SKYTREE.latitude - 0.01, longitude: TOKYO_SKYTREE.longitude, accuracy: 10, timestamp: 0 } }} correctedHeading={0} />)
    expect(html).toContain('かなり近い / 方位が一致しています')
    expect(html).toContain('0.0°')
  })
})
