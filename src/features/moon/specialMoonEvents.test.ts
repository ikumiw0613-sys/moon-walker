import { describe, expect, it } from 'vitest'
import { EclipseKind } from 'astronomy-engine'
import type { LunarEclipseInfo } from 'astronomy-engine'
import { getMoonPhase } from './moonPhase'
import {
  formatSpecialMoonEventDate,
  getDaysUntilSpecialMoonEvent,
  getNextBlueMoon,
  getNextSpecialMoonEvent,
  lunarEclipseToSpecialMoonEvent,
  selectNextSpecialMoonEvent,
} from './specialMoonEvents'
import type { SpecialMoonEvent, SpecialMoonEventType } from './specialMoonEvents'

function event(type: SpecialMoonEventType, date: string, priority: number): SpecialMoonEvent {
  return { type, date: new Date(date), title: type, description: type, priority }
}

describe('special Moon events', () => {
  it('Astronomy Engineから次の満月を取得する', () => {
    const from = new Date('2026-11-10T00:00:00Z')
    const next = getNextSpecialMoonEvent(from)
    expect(next?.type).toBe('full-moon')

    const nextFullMoon = getNextSpecialMoonEvent(new Date('2026-11-10T00:00:00Z'))
    expect(nextFullMoon?.type).toBe('full-moon')
    expect(nextFullMoon?.date.toISOString()).toMatch(/^2026-11-24/)
    expect(Math.abs(getMoonPhase(nextFullMoon!.date).cycleAngle - 180)).toBeLessThan(0.02)
  })

  it('新月直後は同じ暦日の新月を今日のイベントとして返す', () => {
    const from = new Date('2026-11-09T07:03:00Z')
    const next = getNextSpecialMoonEvent(from, 'Asia/Tokyo')
    expect(next).not.toBeNull()
    expect(next!.date.getTime()).toBeLessThan(from.getTime())
    expect(next!.type).toBe('new-moon')
    const angle = getMoonPhase(next!.date).cycleAngle
    expect(Math.min(angle, 360 - angle)).toBeLessThan(0.02)
  })

  it('次の新月を検索し、月相角0°の日時を返す', () => {
    const from = new Date('2026-12-01T00:00:00Z')
    const newMoon = getNextSpecialMoonEvent(from)
    expect(newMoon?.type).toBe('new-moon')
    expect(newMoon!.date.getTime()).toBeGreaterThan(from.getTime())
    const angle = getMoonPhase(newMoon!.date).cycleAngle
    expect(Math.min(angle, 360 - angle)).toBeLessThan(0.02)
  })

  it('今日すでに新月が起きていれば、未来の満月より今日の新月を優先する', () => {
    const from = new Date('2026-11-09T08:16:00Z')
    const next = getNextSpecialMoonEvent(from, 'Asia/Tokyo')
    expect(next?.type).toBe('new-moon')
    expect(next?.title).toBe('新月')
    expect(next?.date.getTime()).toBeLessThan(from.getTime())
    expect(formatSpecialMoonEventDate(next!.date, 'Asia/Tokyo')).toContain('2026年11月9日')
  })

  it('端末のローカル暦月で2回目になる満月をブルームーンとする', () => {
    const nextBlueMoon = getNextBlueMoon(new Date('2028-12-25T00:00:00Z'), 'Asia/Tokyo')
    expect(nextBlueMoon?.toISOString()).toMatch(/^2029-01-30/)
    const firstFullMoon = new Date('2028-12-31T16:48:00Z')
    expect(formatSpecialMoonEventDate(firstFullMoon, 'Asia/Tokyo')).toContain('2029年1月1日')
    expect(getNextBlueMoon(new Date('2029-01-15T00:00:00Z'), 'Asia/Tokyo')?.toISOString()).toMatch(/^2029-01-30/)
  })

  it('同日または24時間以内ならpriorityを使い、離れたイベントは日時が早い方を選ぶ', () => {
    const from = new Date('2026-11-01T00:00:00Z')
    const fullMoon = event('full-moon', '2026-11-03T00:00:00Z', 50)
    const eclipse = event('total-lunar-eclipse', '2026-11-03T05:00:00Z', 100)
    expect(selectNextSpecialMoonEvent([fullMoon, eclipse], from)?.type).toBe('total-lunar-eclipse')

    const laterEclipse = event('total-lunar-eclipse', '2026-12-01T00:00:00Z', 100)
    expect(selectNextSpecialMoonEvent([laterEclipse, fullMoon], from)?.type).toBe('full-moon')
  })

  it('月食が満月と重なる場合は月食を表示し、説明に満月との重なりを含める', () => {
    const from = new Date('2026-11-01T00:00:00Z')
    const fullMoon = event('full-moon', '2026-11-03T00:00:00Z', 50)
    const eclipse = event('partial-lunar-eclipse', '2026-11-03T01:00:00Z', 95)
    const selected = selectNextSpecialMoonEvent([fullMoon, eclipse], from)
    expect(selected?.type).toBe('partial-lunar-eclipse')
    expect(selected?.description).toContain('満月と重なります')
  })

  it('Astronomy Engineの次の月食をイベントとして検索する', () => {
    const next = getNextSpecialMoonEvent(new Date('2027-02-20T22:00:00Z'))
    expect(next?.type).toBe('penumbral-lunar-eclipse')
    expect(next?.title).toBe('半影月食')
    expect(next?.description).toContain('月食の見え方は地域によって異なります')
  })

  it('満月は2年以内でもブルームーン探索は3年以内で見つける', () => {
    expect(getNextBlueMoon(new Date('2026-11-09T00:00:00Z'), 'UTC')?.getTime()).toBeGreaterThan(
      new Date('2028-11-09T00:00:00Z').getTime(),
    )
  })

  it('過去イベントとイベントなしの状態を処理する', () => {
    const from = new Date('2026-11-10T00:00:00Z')
    expect(selectNextSpecialMoonEvent([event('full-moon', '2026-11-09T00:00:00Z', 50)], from)).toBeNull()
    expect(selectNextSpecialMoonEvent([], from)).toBeNull()
    expect(() => getNextSpecialMoonEvent(new Date(NaN))).toThrow(RangeError)
  })

  it.each([
    [EclipseKind.Total, 'total-lunar-eclipse', '皆既月食'],
    [EclipseKind.Partial, 'partial-lunar-eclipse', '部分月食'],
    [EclipseKind.Penumbral, 'penumbral-lunar-eclipse', '半影月食'],
  ] as const)('Astronomy Engineの%sを月食イベントへ変換する', (kind, type, title) => {
    const date = new Date('2027-02-20T23:12:00Z')
    const eclipse: LunarEclipseInfo = {
      kind, peak: { date } as LunarEclipseInfo['peak'], obscuration: kind === EclipseKind.Total ? 1 : 0.4,
      sd_penum: 60, sd_partial: 30, sd_total: kind === EclipseKind.Total ? 20 : 0,
    }
    expect(lunarEclipseToSpecialMoonEvent(eclipse)).toMatchObject({ type, title, date })
  })

  it('イベントの日付と残り日数を指定したローカルタイムゾーンで計算する', () => {
    const date = new Date('2026-12-31T15:00:00Z')
    expect(formatSpecialMoonEventDate(date, 'Asia/Tokyo')).toContain('2027年1月1日')
    expect(formatSpecialMoonEventDate(date, 'America/Los_Angeles')).toContain('2026年12月31日')
    const from = new Date('2026-12-31T23:30:00Z')
    const eventDate = new Date('2027-01-01T10:00:00Z')
    expect(getDaysUntilSpecialMoonEvent(from, eventDate, 'Asia/Tokyo')).toBe(0)
    expect(getDaysUntilSpecialMoonEvent(from, eventDate, 'America/Los_Angeles')).toBe(1)
  })
})
