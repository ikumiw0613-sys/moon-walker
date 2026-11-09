import { useEffect, useState } from 'react'
import { getNextSpecialMoonEvent } from '../../features/moon/specialMoonEvents'
import type { SpecialMoonEvent } from '../../features/moon/specialMoonEvents'

export function useNextSpecialMoonEvent(now: Date, fixed: boolean): SpecialMoonEvent | null {
  const localDay = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`
  const fixedTime = fixed ? now.getTime() : null
  const [event, setEvent] = useState(() => getNextSpecialMoonEvent(now))
  const eventTime = event?.date.getTime() ?? null

  useEffect(() => {
    const anchor = fixedTime === null ? new Date() : new Date(fixedTime)
    const next = getNextSpecialMoonEvent(anchor)
    const updateTimeout = window.setTimeout(() => setEvent(previous =>
      previous?.date.getTime() === next?.date.getTime() && previous?.type === next?.type ? previous : next), 0)

    if (fixedTime !== null) return () => window.clearTimeout(updateTimeout)
    const nextLocalMidnight = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 1).getTime()
    const nextEventTime = next?.date.getTime() ?? Number.POSITIVE_INFINITY
    const nextRefresh = Math.min(nextLocalMidnight, nextEventTime)
    const eventTimeout = window.setTimeout(() => setEvent(getNextSpecialMoonEvent(new Date())),
      Math.max(1, nextRefresh - Date.now() + 250))
    return () => {
      window.clearTimeout(updateTimeout)
      window.clearTimeout(eventTimeout)
    }
  }, [eventTime, fixedTime, localDay])

  return event
}
