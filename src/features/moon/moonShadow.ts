import { MOON_DISC_GEOMETRY } from './moonDiscGeometry'
import type { MoonPhaseInfo } from './types'

type MoonShadowPhase = Pick<MoonPhaseInfo, 'cycleAngle' | 'illuminatedFraction'>

/**
 * 月の影を表す閉じたSVGパスを返す。照明率が1の場合は影がないためnullを返す。
 * MoonDiscと同じ座標を使い、満ちていく月は右、欠けていく月は左を明るくする。
 * 影の傾き・色・不透明度・ぼかしは描画側で扱う。
 */
export function getMoonShadowPath({ cycleAngle, illuminatedFraction }: MoonShadowPhase): string | null {
  if (!Number.isFinite(cycleAngle) || cycleAngle < 0 || cycleAngle >= 360) {
    throw new RangeError('月相角は0°以上360°未満の有限値で指定してください。')
  }
  if (!Number.isFinite(illuminatedFraction) || illuminatedFraction < 0 || illuminatedFraction > 1) {
    throw new RangeError('照明率は0以上1以下の有限値で指定してください。')
  }

  if (illuminatedFraction === 1) return null

  const { centerX, centerY, radius } = MOON_DISC_GEOMETRY
  const top = `${centerX} ${centerY - radius}`
  const bottom = `${centerX} ${centerY + radius}`

  // 新月では円盤全体を覆う。同じ始点と終点の弧を避け、二つの半円で閉じる。
  if (illuminatedFraction === 0) {
    return `M ${top} A ${radius} ${radius} 0 0 1 ${bottom} A ${radius} ${radius} 0 0 1 ${top} Z`
  }

  // 球面の明暗境界を投影した楕円の横半径は、円盤の半径 × |2 × 照明率 - 1|。
  // 符号を残して、細い三日月と満月に近い月の境界の曲がる側を区別する。
  const terminatorRatio = 2 * illuminatedFraction - 1
  const terminatorRadius = Math.abs(terminatorRatio) * radius
  const outerSweep = cycleAngle < 180 ? 0 : 1

  // 上弦・下弦では楕円の横半径が0になるため、境界を直線として描く。
  const boundary = terminatorRadius === 0
    ? `L ${top}`
    : `A ${terminatorRadius} ${radius} 0 0 ${terminatorRatio < 0 ? outerSweep : 1 - outerSweep} ${top}`

  return `M ${top} A ${radius} ${radius} 0 0 ${outerSweep} ${bottom} ${boundary} Z`
}
