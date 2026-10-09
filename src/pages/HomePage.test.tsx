import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'
import { formatMoonrise } from '../lib/formatMoonrise'

const mocks = vi.hoisted(() => ({ above: true }))
vi.mock('../lib/astronomy', () => ({
  getMoonPosition: () => ({ isAboveHorizon: mocks.above }),
  getNextMoonrise: () => new Date(2026, 9, 10, 18, 30),
}))
const render = () => renderToStaticMarkup(<HomePage navigate={vi.fn()} requestLocation={vi.fn()} state={{ status: 'success', location: { latitude: 35, longitude: 139, accuracy: 10, timestamp: 0 } }} />)

describe('HomePage moon status', () => {
  it('月が出ている場合は現在の状態を表示する', () => {
    mocks.above = true
    expect(render()).toContain('今、月が出ています')
    expect(render()).not.toContain('次の月の出は')
  })
  it('月が出ていない場合は次の月の出を表示する', () => {
    mocks.above = false
    expect(render()).toContain('今、月はまだ出ていません')
    expect(render()).toContain('次の月の出は')
    expect(render()).toContain('18:30ごろ')
  })
  it('日付をまたぐ月の出を明日と表示する', () => {
    expect(formatMoonrise(new Date(2026, 9, 10, 0, 30), new Date(2026, 9, 9, 23))).toBe('明日 0:30ごろ')
  })
  it('位置情報のエラーと再取得ボタンを表示する', () => {
    const html = renderToStaticMarkup(<HomePage navigate={vi.fn()} requestLocation={vi.fn()} state={{ status: 'error', message: '位置情報を許可してください。' }} />)
    expect(html).toContain('位置情報を許可してください。')
    expect(html).toContain('現在地を再取得')
  })
})
