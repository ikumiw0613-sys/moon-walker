import type { SpecialMoonEvent } from '../../features/moon/specialMoonEvents'
import {
  formatSpecialMoonEventDate,
  getDaysUntilSpecialMoonEvent,
} from '../../features/moon/specialMoonEvents'

export function SpecialMoonEventCard({ event, now }: { event: SpecialMoonEvent | null; now: Date }) {
  const daysUntil = event ? getDaysUntilSpecialMoonEvent(now, event.date) : null
  return <aside className="mw-special-moon" aria-labelledby="special-moon-title">
    <h2 id="special-moon-title">次の特別な月</h2>
    {event ? <>
      <p className="mw-special-moon-date">{formatSpecialMoonEventDate(event.date)}</p>
      <p className="mw-special-moon-name">{event.title}</p>
      <p className="mw-special-moon-description">{event.description}</p>
      {daysUntil !== null && daysUntil > 0 && <p className="mw-special-moon-countdown">あと{daysUntil}日</p>}
    </> : <p className="mw-special-moon-description">今後3年間のイベントを見つけられませんでした。</p>}
  </aside>
}
