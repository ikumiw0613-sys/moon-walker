import { EclipseKind, SearchLunarEclipse, SearchMoonPhase } from 'astronomy-engine'
import type { LunarEclipseInfo } from 'astronomy-engine'

export type SpecialMoonEventType =
  | 'full-moon'
  | 'new-moon'
  | 'blue-moon'
  | 'supermoon'
  | 'total-lunar-eclipse'
  | 'partial-lunar-eclipse'
  | 'penumbral-lunar-eclipse'
  | 'harvest-moon'

export type SpecialMoonEvent = {
  type: SpecialMoonEventType
  date: Date
  title: string
  description: string
  priority: number
}

const SEARCH_WINDOW_YEARS = 3
const PHASE_SEARCH_LIMIT_DAYS = 35
const COINCIDENT_EVENT_WINDOW_MS = 24 * 60 * 60 * 1000
// Astronomy Engine's phase search can return the just-reached phase a few seconds
// after the requested start time. Treat phases within this margin as current/past.
const PHASE_SEARCH_MARGIN_MS = 30_000
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

const EVENT_PRIORITY: Record<SpecialMoonEventType, number> = {
  'total-lunar-eclipse': 100,
  'partial-lunar-eclipse': 95,
  'penumbral-lunar-eclipse': 90,
  supermoon: 80,
  'blue-moon': 70,
  'harvest-moon': 60,
  'full-moon': 50,
  'new-moon': 40,
}

function assertValidDate(date: Date): void {
  if (!Number.isFinite(date.getTime())) throw new RangeError('イベント検索には有効な日時が必要です。')
}

function searchNextPhase(targetAngle: 0 | 180, from: Date, end: Date): Date | null {
  let start = new Date(from.getTime())
  for (let attempt = 0; attempt < 3; attempt++) {
    const phase = SearchMoonPhase(targetAngle, start, PHASE_SEARCH_LIMIT_DAYS)
    if (!phase) return null
    const date = phase.date
    if (date.getTime() > from.getTime() + PHASE_SEARCH_MARGIN_MS) {
      return date <= end ? date : null
    }
    start = new Date(date.getTime() + PHASE_SEARCH_MARGIN_MS)
  }
  return null
}

function localMonthKey(date: Date, timeZone = LOCAL_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en', {
    calendar: 'gregory', timeZone, year: 'numeric', month: 'numeric',
  }).formatToParts(date)
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  return `${year}-${month}`
}

function sameLocalDay(first: Date, second: Date, timeZone = LOCAL_TIME_ZONE): boolean {
  return localDateOrdinal(first, timeZone) === localDateOrdinal(second, timeZone)
}

function searchPreviousPhaseOnLocalDay(targetAngle: 0 | 180, from: Date, timeZone: string): Date | null {
  let phase = SearchMoonPhase(targetAngle, from, -PHASE_SEARCH_LIMIT_DAYS)?.date ?? null
  if (phase && phase.getTime() >= from.getTime()) {
    phase = SearchMoonPhase(targetAngle, new Date(from.getTime() - PHASE_SEARCH_MARGIN_MS), -PHASE_SEARCH_LIMIT_DAYS)?.date ?? null
  }
  return phase && phase.getTime() < from.getTime() && sameLocalDay(phase, from, timeZone) ? phase : null
}

export function getNextBlueMoon(from: Date, timeZone = LOCAL_TIME_ZONE): Date | null {
  assertValidDate(from)
  const end = new Date(from.getTime())
  end.setUTCFullYear(end.getUTCFullYear() + SEARCH_WINDOW_YEARS)
  // Monthly Blue Moon definition: the second full moon in the viewer's local calendar month.
  let cursor = from
  let previousFullMoon = SearchMoonPhase(180, from, -PHASE_SEARCH_LIMIT_DAYS)?.date ?? null
  if (previousFullMoon && previousFullMoon.getTime() >= from.getTime()) {
    previousFullMoon = SearchMoonPhase(180, new Date(from.getTime() - PHASE_SEARCH_MARGIN_MS), -PHASE_SEARCH_LIMIT_DAYS)?.date ?? null
  }
  if (previousFullMoon && previousFullMoon.getTime() >= from.getTime()) previousFullMoon = null
  for (let count = 0; count < 40; count++) {
    const fullMoon = searchNextPhase(180, cursor, end)
    if (!fullMoon) return null
    if (previousFullMoon && localMonthKey(previousFullMoon, timeZone) === localMonthKey(fullMoon, timeZone)) return fullMoon
    previousFullMoon = fullMoon
    cursor = new Date(fullMoon.getTime() + PHASE_SEARCH_MARGIN_MS)
  }
  return null
}

function blueMoonOnLocalDay(from: Date, timeZone: string): Date | null {
  const fullMoon = searchPreviousPhaseOnLocalDay(180, from, timeZone)
  if (!fullMoon) return null
  const previousFullMoon = SearchMoonPhase(180, new Date(fullMoon.getTime() - PHASE_SEARCH_MARGIN_MS), -PHASE_SEARCH_LIMIT_DAYS)?.date ?? null
  return previousFullMoon && localMonthKey(previousFullMoon, timeZone) === localMonthKey(fullMoon, timeZone)
    ? fullMoon
    : null
}

export function lunarEclipseToSpecialMoonEvent(eclipse: LunarEclipseInfo): SpecialMoonEvent | null {
  const details = {
    [EclipseKind.Total]: {
      type: 'total-lunar-eclipse', title: '皆既月食', description: '月全体が地球の本影に入ります。',
    },
    [EclipseKind.Partial]: {
      type: 'partial-lunar-eclipse', title: '部分月食', description: '月の一部が地球の本影に入ります。',
    },
    [EclipseKind.Penumbral]: {
      type: 'penumbral-lunar-eclipse', title: '半影月食', description: '月が地球の薄い影を通ります。',
    },
  } as const
  const detail = details[eclipse.kind as keyof typeof details]
  if (!detail) return null
  return {
    ...detail,
    type: detail.type,
    date: eclipse.peak.date,
    description: `${detail.description} 月食の見え方は地域によって異なります。`,
    priority: EVENT_PRIORITY[detail.type],
  }
}

function nextLunarEclipse(from: Date, end: Date): SpecialMoonEvent | null {
  let searchStart = from
  for (let attempt = 0; attempt < 3; attempt++) {
    const eclipse = SearchLunarEclipse(searchStart)
    const date = eclipse.peak.date
    if (date.getTime() > from.getTime() + PHASE_SEARCH_MARGIN_MS) {
      if (date > end) return null
      return lunarEclipseToSpecialMoonEvent(eclipse)
    }
    searchStart = new Date(date.getTime() + PHASE_SEARCH_MARGIN_MS)
  }
  return null
}

/**
 * Find the nearest supported special Moon event within three years.
 * Supermoon is omitted because its distance threshold is not standardized.
 * TODO: Harvest Moon requires an explicitly chosen harvest-moon rule and a maintained
 * Chinese-lunar-calendar conversion, neither of which exists in this project yet.
 * Supermoon requires a distance cutoff; published definitions differ, so no cutoff is invented here.
 */
export function getNextSpecialMoonEvent(from: Date, timeZone = LOCAL_TIME_ZONE): SpecialMoonEvent | null {
  assertValidDate(from)
  const end = new Date(from.getTime())
  end.setUTCFullYear(end.getUTCFullYear() + SEARCH_WINDOW_YEARS)

  const fullMoon = searchNextPhase(180, from, end)
  const newMoon = searchNextPhase(0, from, end)
  const fullMoonToday = searchPreviousPhaseOnLocalDay(180, from, timeZone)
  const newMoonToday = searchPreviousPhaseOnLocalDay(0, from, timeZone)
  const blueMoon = getNextBlueMoon(from, timeZone)
  const blueMoonToday = blueMoonOnLocalDay(from, timeZone)
  const recentEclipse = SearchLunarEclipse(new Date(from.getTime() - 36 * 60 * 60 * 1000))
  const eclipseToday = sameLocalDay(recentEclipse.peak.date, from, timeZone)
    ? lunarEclipseToSpecialMoonEvent(recentEclipse)
    : null
  const eclipse = nextLunarEclipse(from, end)
  const candidates: SpecialMoonEvent[] = []

  if (fullMoon) candidates.push({
    type: 'full-moon', date: fullMoon, title: '満月',
    description: '月の円盤がほぼ全面照らされます。', priority: EVENT_PRIORITY['full-moon'],
  })
  if (fullMoonToday) candidates.push({
    type: 'full-moon', date: fullMoonToday, title: '満月',
    description: '月の円盤がほぼ全面照らされます。', priority: EVENT_PRIORITY['full-moon'],
  })
  if (newMoon) candidates.push({
    type: 'new-moon', date: newMoon, title: '新月',
    description: '月と太陽が同じ方向に並ぶころです。', priority: EVENT_PRIORITY['new-moon'],
  })
  if (newMoonToday) candidates.push({
    type: 'new-moon', date: newMoonToday, title: '新月',
    description: '月と太陽が同じ方向に並ぶころです。', priority: EVENT_PRIORITY['new-moon'],
  })
  if (blueMoon) candidates.push({
    type: 'blue-moon', date: blueMoon, title: 'ブルームーン',
    description: '同じ暦月に起きる2回目の満月です。', priority: EVENT_PRIORITY['blue-moon'],
  })
  if (blueMoonToday) candidates.push({
    type: 'blue-moon', date: blueMoonToday, title: 'ブルームーン',
    description: '同じ暦月に起きる2回目の満月です。', priority: EVENT_PRIORITY['blue-moon'],
  })
  if (eclipseToday) candidates.push(eclipseToday)
  if (eclipse) candidates.push(eclipse)

  return selectNextSpecialMoonEvent(candidates, from, timeZone)
}

/** Earlier events win; priority only breaks ties within 24 hours. */
export function selectNextSpecialMoonEvent(events: SpecialMoonEvent[], from: Date, timeZone = LOCAL_TIME_ZONE): SpecialMoonEvent | null {
  assertValidDate(from)
  const today = events.filter(event => Number.isFinite(event.date.getTime()) && sameLocalDay(event.date, from, timeZone))
  const upcoming = events
    .filter(event => Number.isFinite(event.date.getTime()) && event.date.getTime() > from.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
  const first = upcoming[0]
  if (today.length) return selectByPriority(today)
  if (!first) return null

  const coincident = upcoming.filter(event =>
    event.date.getTime() - first.date.getTime() <= COINCIDENT_EVENT_WINDOW_MS)
  return selectByPriority(coincident)
}

function selectByPriority(events: SpecialMoonEvent[]): SpecialMoonEvent {
  const selected = events.reduce((best, event) => event.priority > best.priority ? event : best)
  if (selected.type === 'total-lunar-eclipse' || selected.type === 'partial-lunar-eclipse'
    || selected.type === 'penumbral-lunar-eclipse') {
    const description = events.some(event => event.type === 'full-moon')
      ? `${selected.description} 満月と重なります。`
      : selected.description
    return { ...selected, description }
  }
  return selected
}

function localDateOrdinal(date: Date, timeZone = LOCAL_TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat('en', {
    calendar: 'gregory', timeZone, year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(date)
  const part = (type: string) => Number(parts.find(item => item.type === type)?.value)
  return Date.UTC(part('year'), part('month') - 1, part('day')) / MILLISECONDS_PER_DAY
}

export function formatSpecialMoonEventDate(date: Date, timeZone = LOCAL_TIME_ZONE): string {
  return new Intl.DateTimeFormat('ja-JP', {
    calendar: 'gregory', timeZone, year: 'numeric', month: 'long', day: 'numeric',
  }).format(date)
}

export function getDaysUntilSpecialMoonEvent(from: Date, eventDate: Date, timeZone = LOCAL_TIME_ZONE): number {
  assertValidDate(from)
  assertValidDate(eventDate)
  return Math.max(0, localDateOrdinal(eventDate, timeZone) - localDateOrdinal(from, timeZone))
}
