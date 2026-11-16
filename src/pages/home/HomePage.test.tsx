import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'
import { formatMoonrise } from '../../features/moon/formatMoonrise'

const mocks = vi.hoisted(() => ({ above: true }))
vi.mock('../../features/moon/astronomy', () => ({
  getMoonPosition: () => ({ isAboveHorizon: mocks.above }),
  getNextMoonrise: () => new Date(2026, 9, 10, 18, 30),
}))
const render = () => renderToStaticMarkup(<HomePage navigate={vi.fn()} requestLocation={vi.fn()} state={{ status: 'success', location: { latitude: 35, longitude: 139, accuracy: 10, timestamp: 0 } }} />)

describe('HomePage moon status', () => {
  it('月が出ている場合は現在の状態を表示する', () => {
    mocks.above = true
    expect(render()).toContain('月を探す準備に進みます')
    expect(render()).not.toContain('次に見えるのは')
  })
  it('月が出ていない場合は次の月の出を表示する', () => {
    mocks.above = false
    const html = render()
    expect(html).toContain('今は月が見えません')
    expect(html).toContain('次に見えるのは')
    expect(html).toContain('18:30ごろ')
    expect(html).toContain('天気を表示')
    expect(html).not.toContain('現在地の天気')
  })
  it('日付をまたぐ月の出を明日と表示する', () => {
    expect(formatMoonrise(new Date(2026, 9, 10, 0, 30), new Date(2026, 9, 9, 23))).toBe('明日 0:30ごろ')
  })
  it('位置情報のエラーと再取得ボタンを表示する', () => {
    const html = renderToStaticMarkup(<HomePage navigate={vi.fn()} requestLocation={vi.fn()} state={{ status: 'error', message: '位置情報を許可してください。' }} />)
    expect(html).toContain('<h1 id="app-title">スマホで月の方向を探すWebアプリ</h1>')
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toContain('moon-walkerは、現在地・時刻・スマートフォンの向きから')
    expect(html).toContain('role="alert"')
    expect(html).toContain('ブラウザの設定で位置情報を許可して、もう一度お試しください。')
    expect(html).toContain('位置情報を許可してください。')
    expect(html).toContain('現在地を再取得')
  })

  it('月情報が表示される場合もサービス紹介と単一のh1を維持する', () => {
    mocks.above = false
    const html = render()
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toContain('moon-walkerは、現在地・時刻・スマートフォンの向きから')
    expect(html).toContain('次に見えるのは')
    expect(html).toContain('月の情報を見る')
  })
})
