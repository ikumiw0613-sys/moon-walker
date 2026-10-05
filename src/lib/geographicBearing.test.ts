import { describe, expect, it } from 'vitest'
import { calculateBearing, calculateDistance, compareHeadingToBearing, normalizeSignedAngle } from './geographicBearing'

describe('geographic bearing and distance', () => {
  it('同一点の距離は0で方位は未確定', () => {
    expect(calculateDistance(35, 139, 35, 139)).toBe(0)
    expect(calculateBearing(35, 139, 35, 139)).toBeNull()
  })

  it.each([[1, 0, 0], [0, 1, 90], [-1, 0, 180], [0, -1, 270]])(
    '原点から(%s, %s)の方位は%s度', (latitude, longitude, expected) => {
      expect(calculateBearing(0, 0, latitude, longitude)).toBeCloseTo(expected)
    },
  )

  it('赤道の1度は約111.195kmで距離は対称', () => {
    expect(calculateDistance(0, 0, 0, 1)).toBeCloseTo(111194.927, 2)
    expect(calculateDistance(35, 139, 36, 140)).toBe(calculateDistance(36, 140, 35, 139))
  })

  it('日付変更線の境界をまたぐ短い経路を使う', () => {
    expect(calculateBearing(0, 179, 0, -179)).toBeCloseTo(90)
    expect(calculateDistance(0, 179, 0, -179)).toBeCloseTo(222389.853, 2)
  })

  it('不正な座標と対蹠点の方位を拒否する', () => {
    expect(calculateBearing(NaN, 0, 0, 1)).toBeNull()
    expect(calculateDistance(91, 0, 0, 1)).toBeNull()
    expect(calculateBearing(0, 0, 0, 180)).toBeNull()
  })
})

describe('heading error to landmark', () => {
  it.each([[1, 359, 2, '少し左へ'], [359, 1, -2, '少し右へ'], [120.8, 123.4, -2.6, '少し右へ'], [125, 120, 5, '少し左へ']])(
    'heading %sとbearing %sの誤差は%sで%s', (heading, bearing, error, guidance) => {
      const result = compareHeadingToBearing(heading, bearing)!
      expect(result.headingError).toBeCloseTo(error)
      expect(result.guidance).toBe(guidance)
    },
  )

  it('一致なら誤差0', () => {
    expect(compareHeadingToBearing(123.4, 123.4)).toEqual({ headingError: 0, assessment: 'かなり近い', guidance: '方位が一致しています' })
    expect(compareHeadingToBearing(360, 0)?.headingError).toBe(0)
  })

  it.each([[5, 'かなり近い'], [-5, 'かなり近い'], [5.01, '概ね一致'], [10, '概ね一致'], [-10, '概ね一致'], [10.01, 'ズレあり']])(
    '誤差%sの評価は%s', (error, assessment) => {
      expect(compareHeadingToBearing(error, 0)?.assessment).toBe(assessment)
    },
  )

  it('未取得値と非有限値では比較しない', () => {
    expect(compareHeadingToBearing(null, 120)).toBeNull()
    expect(compareHeadingToBearing(120, null)).toBeNull()
    expect(compareHeadingToBearing(NaN, 120)).toBeNull()
  })

  it('符号付き角度は既存と同じ[-180,180)になる', () => {
    expect(normalizeSignedAngle(180)).toBe(-180)
    expect(normalizeSignedAngle(361)).toBe(1)
    expect(normalizeSignedAngle(-361)).toBe(-1)
  })
})
