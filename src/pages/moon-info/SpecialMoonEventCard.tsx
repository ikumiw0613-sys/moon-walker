import type { SpecialMoonEvent } from '../../features/moon/specialMoonEvents'
import {
  formatSpecialMoonEventDate,
  getDaysUntilSpecialMoonEvent,
} from '../../features/moon/specialMoonEvents'

export function SpecialMoonEventCard({ event, now }: { event: SpecialMoonEvent | null; now: Date }) {
  return <aside className="mw-special-moon" aria-labelledby="special-moon-title">
    <p className="mw-special-moon-kicker">SPECIAL MOON</p>
    <h2 id="special-moon-title">次の特別な月</h2>
    {event ? <>
      <p className="mw-special-moon-date">{formatSpecialMoonEventDate(event.date)}</p>
      <p className="mw-special-moon-name">{event.title}</p>
      <p className="mw-special-moon-description">{event.description}</p>
      <p className="mw-special-moon-countdown">{getDaysUntilSpecialMoonEvent(now, event.date) === 0
        ? '今日'
        : `あと${getDaysUntilSpecialMoonEvent(now, event.date)}日`}</p>
    </> : <p className="mw-special-moon-description">今後3年間のイベントを見つけられませんでした。</p>}
  </aside>
}
