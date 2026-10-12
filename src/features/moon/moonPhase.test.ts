import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Astronomy from 'astronomy-engine'
import { getMoonPhase } from './moonPhase'

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

afterEach(() => vi.restoreAllMocks())

describe('getMoonPhase', () => {
  // 計算結果と独立した基準として、米海軍天文台の公開日時を使う。
  // 公開日時は分単位のため、暦計算の差と日時の丸めを考慮した許容誤差で検証する。
  // https://aa.usno.navy.mil/calculated/moon/phases?date=2026-09-01&nump=8
  it.each([
    { date: '2026-10-03T13:25:00Z', angle: 270, fraction: 0.5 },
    { date: '2026-10-10T15:50:00Z', angle: 0, fraction: 0 },
    { date: '2026-10-18T16:12:00Z', angle: 90, fraction: 0.5 },
    { date: '2026-10-26T04:12:00Z', angle: 180, fraction: 1 },
  ])('既知の月相 $date が月相角 $angle°と一致する', ({ date, angle, fraction }) => {
    const phase = getMoonPhase(new Date(date))
    const difference = ((phase.cycleAngle - angle + 180) % 360 + 360) % 360 - 180
    expect(Math.abs(difference)).toBeLessThan(0.02)
    expect(Math.abs(phase.illuminatedFraction - fraction)).toBeLessThan(0.005)
    expect(phase.ageDays).toBeGreaterThanOrEqual(0)
    expect(phase.ageDays).toBeLessThan(31)
    expect(phase.cycleAngle).toBeGreaterThanOrEqual(0)
    expect(phase.cycleAngle).toBeLessThan(360)
    expect(phase.illuminatedFraction).toBeGreaterThanOrEqual(0)
    expect(phase.illuminatedFraction).toBeLessThanOrEqual(1)
  })

  it('直前の新月からの実際の経過日数を、小数のまま返す', () => {
    const date = new Date('2026-10-12T00:00:00Z')
    const previousNewMoon = new Date('2026-10-10T15:50:00Z')
    const expectedAge = (date.getTime() - previousNewMoon.getTime()) / MILLISECONDS_PER_DAY
    const phase = getMoonPhase(date)
    expect(Math.abs(phase.ageDays - expectedAge)).toBeLessThan(1 / 1440)
    expect(Number.isInteger(phase.ageDays)).toBe(false)
  })

  it('新月の直前と直後で、月齢と月相角が次の周期へ切り替わる', () => {
    const before = getMoonPhase(new Date('2026-10-10T15:49:00Z'))
    const after = getMoonPhase(new Date('2026-10-10T15:51:00Z'))
    expect(before.ageDays).toBeGreaterThan(29)
    expect(before.cycleAngle).toBeGreaterThan(359)
    expect(after.ageDays).toBeGreaterThanOrEqual(0)
    expect(after.ageDays).toBeLessThan(2 / 1440)
    expect(after.cycleAngle).toBeLessThan(1)
    expect(before.illuminatedFraction).toBeLessThan(0.005)
    expect(after.illuminatedFraction).toBeLessThan(0.005)
  })

  it('半月でも満ちている月と欠けている月を月相角で区別できる', () => {
    const waxing = getMoonPhase(new Date('2026-10-18T16:12:00Z'))
    const waning = getMoonPhase(new Date('2026-10-03T13:25:00Z'))
    expect(waxing.cycleAngle).toBeLessThan(180)
    expect(waning.cycleAngle).toBeGreaterThan(180)
    expect(Math.abs(waxing.illuminatedFraction - waning.illuminatedFraction)).toBeLessThan(0.01)
  })

  it('満月の前後でも月齢が進み、月相角が180°をまたぐ', () => {
    const before = getMoonPhase(new Date('2026-10-26T03:12:00Z'))
    const after = getMoonPhase(new Date('2026-10-26T05:12:00Z'))
    expect(before.cycleAngle).toBeLessThan(180)
    expect(after.cycleAngle).toBeGreaterThan(180)
    expect(after.ageDays - before.ageDays).toBeCloseTo(2 / 24, 6)
    expect(before.illuminatedFraction).toBeGreaterThan(0.99)
    expect(after.illuminatedFraction).toBeGreaterThan(0.99)
  })

  it('年をまたいでも月齢は連続して進む', () => {
    const before = getMoonPhase(new Date('2026-12-31T23:00:00Z'))
    const after = getMoonPhase(new Date('2027-01-01T01:00:00Z'))
    expect(after.ageDays - before.ageDays).toBeCloseTo(2 / 24, 6)
  })

  it('タイムゾーン表記が異なっても、同じ瞬間なら同じ結果を返す', () => {
    expect(getMoonPhase(new Date('2026-10-12T09:00:00+09:00')))
      .toEqual(getMoonPhase(new Date('2026-10-12T00:00:00Z')))
  })

  it('現在時刻に依存せず、引数の日時を変更しない', () => {
    const date = new Date('2026-10-12T00:00:00Z')
    const timestamp = date.getTime()
    const initial = getMoonPhase(date)
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2030-01-01T00:00:00Z').getTime())
    expect(getMoonPhase(date)).toEqual(initial)
    expect(date.getTime()).toBe(timestamp)
  })

  it('無効な日時は明示的に拒否する', () => {
    expect(() => getMoonPhase(new Date(NaN))).toThrow(RangeError)
  })

  it('新月を検索できない場合、架空の月齢を返さずエラーにする', () => {
    vi.spyOn(Astronomy, 'SearchMoonPhase').mockReturnValueOnce(null)
    expect(() => getMoonPhase(new Date('2026-10-12T00:00:00Z'))).toThrow('直前の新月')
  })

  it('検索結果が未来にずれた場合、過去の新月を探し直す', () => {
    const date = new Date('2026-10-10T15:50:00Z')
    vi.spyOn(Astronomy, 'SearchMoonPhase').mockReturnValueOnce(new Astronomy.AstroTime(new Date(date.getTime() + 10)))
    const phase = getMoonPhase(date)
    expect(phase.ageDays).toBeGreaterThan(29)
    expect(phase.ageDays).toBeLessThan(31)
  })
})
