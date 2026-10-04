import { describe, expect, it } from 'vitest'
import { convertMoonToScreen } from './coordinates'

describe('convertMoonToScreen', () => {
  it('視点と同じ方位角・高度の月を中央に表示する', () => {
    expect(convertMoonToScreen(120, 30, 120, 30)).toEqual({ x: 50, y: 50, isVisible: true })
  })

  it('0度をまたいでも最短の方位角差を使う', () => {
    const right = convertMoonToScreen(5, 0, 355, 0)
    const left = convertMoonToScreen(355, 0, 5, 0)
    expect(right.x).toBeCloseTo(50 + 10 / 45 * 50)
    expect(left.x).toBeCloseTo(50 - 10 / 45 * 50)
    expect(right.isVisible).toBe(true)
    expect(left.isVisible).toBe(true)
  })

  it('視野の境界を含み、視野外の月を非表示にする', () => {
    expect(convertMoonToScreen(45, 30, 0, 0)).toEqual({ x: 100, y: 0, isVisible: true })
    expect(convertMoonToScreen(46, 0, 0, 0).isVisible).toBe(false)
    expect(convertMoonToScreen(0, 31, 0, 0).isVisible).toBe(false)
    expect(convertMoonToScreen(180, 0, 0, 0).isVisible).toBe(false)
  })
})
