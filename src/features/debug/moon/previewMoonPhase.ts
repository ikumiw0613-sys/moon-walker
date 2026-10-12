import type { MoonPhaseShape } from '../../moon/types'
import { normalizeAzimuth } from '../../../shared/math/angles'

export const MOON_PHASE_PRESETS = [
  { label: '新月', angle: 0 },
  { label: '満ちる三日月', angle: 45 },
  { label: '上弦', angle: 90 },
  { label: '満月へ向かう月', angle: 135 },
  { label: '満月', angle: 180 },
  { label: '欠け始めた月', angle: 225 },
  { label: '下弦', angle: 270 },
  { label: '欠ける三日月', angle: 315 },
] as const

export const MOON_PHASE_BOUNDARIES = [0, 0.1, 89.9, 90, 90.1, 179.9, 180, 180.1, 269.9, 270, 270.1, 359.9, 360] as const

/** 目視確認用の模式的な月相。実際の日付や月齢を生成せず、ARの観測時刻には影響しない。 */
export function getPreviewMoonPhase(angle: number): MoonPhaseShape {
  if (!Number.isFinite(angle)) throw new RangeError('プレビューの月相角は有限値で指定してください。')
  const cycleAngle = normalizeAzimuth(angle)
  // 代表的な月相は端数を残さず、新月・半月・満月の描画分岐も確認できるようにする。
  const illuminatedFraction = cycleAngle === 0 ? 0
    : cycleAngle === 180 ? 1
      : cycleAngle === 90 || cycleAngle === 270 ? 0.5
        : (1 - Math.cos(cycleAngle * Math.PI / 180)) / 2
  return { cycleAngle, illuminatedFraction }
}
