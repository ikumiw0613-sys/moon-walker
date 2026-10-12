import { describe, expect, it } from 'vitest'
import { getMoonShadowPath } from './moonShadow'
import { getMoonPhase } from './moonPhase'

type Point = { x: number; y: number }

// 生成されたSVGの半円・半楕円を点列として読み取り、文字列の一致ではなく領域を検証する。
function samplePath(path: string | null): Point[] {
  if (path === null) return []
  const tokens = path.match(/[MLAZ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi)!
  const points: Point[] = []
  let index = 0
  const number = () => {
    const value = Number(tokens[index++])
    if (!Number.isFinite(value)) throw new Error('パスに無効な数値があります。')
    return value
  }

  while (index < tokens.length) {
    const command = tokens[index++]
    if (command === 'M' || command === 'L') {
      points.push({ x: number(), y: number() })
    } else if (command === 'A') {
      const rx = number(), ry = number(), rotation = number(), largeArc = number(), sweep = number()
      const end = { x: number(), y: number() }
      const start = points.at(-1)!
      if (rx <= 0 || ry <= 0 || rotation !== 0 || largeArc !== 0 || ![0, 1].includes(sweep)
        || start.x !== end.x || Math.abs(start.y - end.y) !== 2 * ry) {
        throw new Error('想定した半円・半楕円の形式ではありません。')
      }
      const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2
      const startAngle = Math.atan2((start.y - cy) / ry, (start.x - cx) / rx)
      for (let step = 1; step <= 200; step++) {
        const angle = startAngle + (sweep === 1 ? 1 : -1) * Math.PI * step / 200
        points.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) })
      }
      // 次の弧の計算で、三角関数の微小な丸め誤差を持ち越さない。
      points[points.length - 1] = end
    } else if (command === 'Z') {
      points.push(points[0]!)
    } else {
      throw new Error(`未対応のパス命令です: ${command}`)
    }
  }
  return points
}

function shadowAreaFraction(points: Point[]): number {
  const doubledArea = points.slice(1).reduce((sum, point, index) => {
    const previous = points[index]!
    return sum + previous.x * point.y - point.x * previous.y
  }, 0)
  return Math.abs(doubledArea) / (2 * Math.PI * 50 ** 2)
}

function contains(points: Point[], target: Point): boolean {
  let inside = false
  for (let index = 0, previousIndex = points.length - 1; index < points.length; previousIndex = index++) {
    const a = points[index]!, b = points[previousIndex]!
    if ((a.y > target.y) !== (b.y > target.y)
      && target.x < (b.x - a.x) * (target.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

const fractions = [0, 0.001, 0.1, 0.25, 0.499999, 0.5, 0.500001, 0.75, 0.9, 0.999, 1]

describe('getMoonShadowPath', () => {
  it.each([60, 300].flatMap(cycleAngle => fractions.map(illuminatedFraction => ({ cycleAngle, illuminatedFraction }))))(
    '月相角$cycleAngle°・照明率$illuminatedFractionの影の面積が暗い割合と一致する', phase => {
      const points = samplePath(getMoonShadowPath(phase))
      expect(Math.abs(shadowAreaFraction(points) - (1 - phase.illuminatedFraction))).toBeLessThan(0.0001)
      points.forEach(point => {
        expect(Math.hypot(point.x - 50, point.y - 50)).toBeLessThanOrEqual(50 + 1e-9)
      })
    },
  )

  it.each([0.1, 0.25, 0.5, 0.75, 0.9])('同じ照明率%sの満ちる月と欠ける月では影が左右対称になる', illuminatedFraction => {
    const waxing = samplePath(getMoonShadowPath({ cycleAngle: 60, illuminatedFraction }))
    const waning = samplePath(getMoonShadowPath({ cycleAngle: 300, illuminatedFraction }))
    expect(waxing.length).toBe(waning.length)
    waxing.forEach((point, index) => {
      expect(point.x + waning[index]!.x).toBeCloseTo(100, 10)
      expect(point.y).toBeCloseTo(waning[index]!.y, 10)
    })
  })

  it('上弦は左半分、下弦は右半分に影を作る', () => {
    const firstQuarter = samplePath(getMoonShadowPath({ cycleAngle: 90, illuminatedFraction: 0.5 }))
    const lastQuarter = samplePath(getMoonShadowPath({ cycleAngle: 270, illuminatedFraction: 0.5 }))
    expect(contains(firstQuarter, { x: 25, y: 50 })).toBe(true)
    expect(contains(firstQuarter, { x: 75, y: 50 })).toBe(false)
    expect(contains(lastQuarter, { x: 25, y: 50 })).toBe(false)
    expect(contains(lastQuarter, { x: 75, y: 50 })).toBe(true)
  })

  it('細い三日月では中心を暗くし、満月に近い月では中心を明るくする', () => {
    expect(contains(samplePath(getMoonShadowPath({ cycleAngle: 45, illuminatedFraction: 0.1 })), { x: 50, y: 50 })).toBe(true)
    expect(contains(samplePath(getMoonShadowPath({ cycleAngle: 135, illuminatedFraction: 0.9 })), { x: 50, y: 50 })).toBe(false)
  })

  it('照明率0では全面を覆い、照明率1では影を返さない', () => {
    const newMoon = samplePath(getMoonShadowPath({ cycleAngle: 0, illuminatedFraction: 0 }))
    expect(contains(newMoon, { x: 25, y: 50 })).toBe(true)
    expect(contains(newMoon, { x: 75, y: 50 })).toBe(true)
    expect(getMoonShadowPath({ cycleAngle: 180, illuminatedFraction: 1 })).toBeNull()
  })

  it('半月の前後でも影の面積が連続して減る', () => {
    const areas = [0.499999, 0.5, 0.500001].map(illuminatedFraction =>
      shadowAreaFraction(samplePath(getMoonShadowPath({ cycleAngle: 90, illuminatedFraction }))))
    expect(areas[0]!).toBeGreaterThan(areas[1]!)
    expect(areas[1]!).toBeGreaterThan(areas[2]!)
    expect(areas[0]! - areas[2]!).toBeLessThan(0.00001)
  })

  it('実際の月相計算の結果をそのまま影の生成に渡せる', () => {
    const phase = getMoonPhase(new Date('2026-10-12T09:00:00+09:00'))
    const area = shadowAreaFraction(samplePath(getMoonShadowPath(phase)))
    expect(Math.abs(area - (1 - phase.illuminatedFraction))).toBeLessThan(0.0001)
  })

  it.each([0, 180])('月相角%s°の境界前後でも、影の面積が連続する', boundary => {
    const areas = [-0.001, 0, 0.001].map(offset => {
      const cycleAngle = ((boundary + offset) % 360 + 360) % 360
      const illuminatedFraction = (1 - Math.cos(cycleAngle * Math.PI / 180)) / 2
      const path = getMoonShadowPath({ cycleAngle, illuminatedFraction })
      if (path !== null) expect(path).not.toMatch(/NaN|Infinity/)
      return shadowAreaFraction(samplePath(path))
    })
    expect(Math.abs(areas[0]! - areas[1]!)).toBeLessThan(1e-8)
    expect(Math.abs(areas[2]! - areas[1]!)).toBeLessThan(1e-8)
  })

  it.each([-1, 360, NaN, Infinity])('無効な月相角%sを拒否する', cycleAngle => {
    expect(() => getMoonShadowPath({ cycleAngle, illuminatedFraction: 0.5 })).toThrow(RangeError)
  })

  it.each([-0.01, 1.01, NaN, Infinity])('無効な照明率%sを拒否する', illuminatedFraction => {
    expect(() => getMoonShadowPath({ cycleAngle: 90, illuminatedFraction })).toThrow(RangeError)
  })
})
