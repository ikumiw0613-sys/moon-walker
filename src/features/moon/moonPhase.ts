import { Body, Illumination, MoonPhase, SearchMoonPhase } from 'astronomy-engine'
import type { MoonPhaseInfo } from './types'

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
// 新月を探すため、一周期に余裕を持たせた検索範囲。月齢の計算には実際の新月の日時を使う。
const NEW_MOON_SEARCH_DAYS = 35

/**
 * 指定日時の月相を計算する。React・位置情報・センサーには依存しない。
 * cycleAngle は MoonPhase の0〜360°未満の月相角を表す。
 * Illumination の phase_angle は別の角度で、満月を0°とするため混同しない。
 */
export function getMoonPhase(date: Date): MoonPhaseInfo {
  const observationTime = date.getTime()
  if (!Number.isFinite(observationTime)) {
    throw new RangeError('月相の計算には有効な日時が必要です。')
  }

  let previousNewMoon = SearchMoonPhase(0, date, -NEW_MOON_SEARCH_DAYS)
  // 新月付近では、数値計算によって検索結果が開始時刻よりわずかに未来へずれる場合がある。
  // 前日から検索し直し、月齢の計算に未来の新月を使わないようにする。
  if (previousNewMoon && previousNewMoon.date.getTime() > observationTime) {
    previousNewMoon = SearchMoonPhase(0, new Date(observationTime - MILLISECONDS_PER_DAY), -NEW_MOON_SEARCH_DAYS)
  }
  if (!previousNewMoon) {
    throw new Error('月齢の計算に必要な直前の新月を見つけられませんでした。')
  }

  return {
    ageDays: (observationTime - previousNewMoon.date.getTime()) / MILLISECONDS_PER_DAY,
    cycleAngle: MoonPhase(date),
    illuminatedFraction: Illumination(Body.Moon, date).phase_fraction,
  }
}
