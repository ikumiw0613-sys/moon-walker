import { describe, expect, it } from 'vitest'
import { getOrientationDiagnostics } from './deviceOrientationDiagnostics'

const orientation = { alpha: 270, beta: 90, gamma: 0, absolute: true, compassHeading: null }

describe('orientation diagnostic readouts', () => {
  it('絶対方位で東向きの補正前後を表示する', () => {
    const result = getOrientationDiagnostics(orientation, null)
    expect(result.before?.x).toBeCloseTo(1)
    expect(result.beforeDirection?.azimuth).toBeCloseTo(90)
    expect(result.after?.x).toBeCloseTo(1)
    expect(result.correctionAngle).toBe(0)
    expect(result.correctionSource).toBe('absolute')
  })

  it('現在のコンパス補正の180°反転を隠さず表示する', () => {
    const input = { ...orientation, alpha: 42, absolute: false, compassHeading: 90 }
    const below = getOrientationDiagnostics({ ...input, beta: 89.9 }, null)
    const above = getOrientationDiagnostics({ ...input, beta: 90.1 }, null)
    expect(below.afterDirection?.azimuth).toBeCloseTo(90)
    expect(above.afterDirection?.azimuth).toBeCloseTo(270)
    expect(below.correctionAngle).toBeCloseTo(132)
    expect(above.correctionAngle).toBeCloseTo(-48)
    expect(above.correctionSource).toBe('webkitCompassHeading')
  })

  it('absoluteとheadingが両方あるときも既存のheading補正を表示する', () => {
    const result = getOrientationDiagnostics({ ...orientation, compassHeading: 123 }, 10)
    expect(result.correctionSource).toBe('webkitCompassHeading')
    expect(result.afterDirection?.azimuth).toBeCloseTo(123)
  })

  it('相対姿勢に北基準がない場合、補正後を未取得とする', () => {
    const result = getOrientationDiagnostics({ ...orientation, absolute: false }, null)
    expect(result.before).not.toBeNull()
    expect(result.after).toBeNull()
    expect(result.correctionAngle).toBeNull()
    expect(result.correctionSource).toBe('なし')
  })

  it('既存の手動北補正を表示する', () => {
    const result = getOrientationDiagnostics({ ...orientation, absolute: false }, -90)
    expect(result.afterDirection?.azimuth).toBeCloseTo(0)
    expect(result.correctionAngle).toBe(-90)
    expect(result.correctionSource).toBe('手動補正')
  })

  it('未取得値と真上・真下の未確定方位を明示できる', () => {
    const missing = getOrientationDiagnostics({ ...orientation, alpha: null }, null)
    expect(missing.before).toBeNull()
    expect(missing.topHeading).toBeNull()
    const vertical = getOrientationDiagnostics({ ...orientation, beta: 0 }, null)
    expect(vertical.before).not.toBeNull()
    expect(vertical.beforeDirection).toBeNull()
    expect(vertical.after).toBeNull()
  })
})
