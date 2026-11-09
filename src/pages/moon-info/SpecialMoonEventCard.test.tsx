import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { formatSpecialMoonEventDate, getDaysUntilSpecialMoonEvent } from '../../features/moon/specialMoonEvents'
import { SpecialMoonEventCard } from './SpecialMoonEventCard'
import type { SpecialMoonEvent } from '../../features/moon/specialMoonEvents'

describe('SpecialMoonEventCard', () => {
  it('イベント未取得時は範囲を明示した案内を表示する', () => {
    const html = renderToStaticMarkup(<SpecialMoonEventCard event={null} now={new Date('2026-11-09T00:00:00Z')} />)
    expect(html).toContain('次の特別な月')
    expect(html).toContain('今後3年間のイベントを見つけられませんでした')
  })

  it('イベント名・端末ローカル日付・残り日数・説明を表示する', () => {
    const event: SpecialMoonEvent = {
      type: 'total-lunar-eclipse',
      date: new Date('2026-12-31T15:00:00Z'),
      title: '皆既月食',
      description: '月全体が地球の本影に入ります。',
      priority: 100,
    }
    const html = renderToStaticMarkup(<SpecialMoonEventCard event={event} now={new Date('2026-12-31T00:00:00Z')} />)
    expect(html).toContain('皆既月食')
    expect(html).toContain(formatSpecialMoonEventDate(event.date))
    const daysUntil = getDaysUntilSpecialMoonEvent(new Date('2026-12-31T00:00:00Z'), event.date)
    if (daysUntil === 0) expect(html).not.toContain('mw-special-moon-countdown')
    else expect(html).toContain(`あと${daysUntil}日`)
    expect(html).toContain('月全体が地球の本影に入ります。')
  })
})
