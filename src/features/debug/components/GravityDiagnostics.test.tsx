import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Matrix3 } from '../../../shared/math/types'
import type { DebugMotionState } from '../useDebugDeviceMotion'
import { GravityDiagnostics } from './GravityDiagnostics'
import { MoonTransformReadout } from './MoonTransformReadout'
import { getMoonDeviceState } from '../../moon-guide/moonDeviceNavigation'
import type { MoonPipelineContext } from '../moonPipelineDiagnostics'

const context: MoonPipelineContext = {
  observationDate: new Date('2026-10-11T01:00:00Z'), timeMode: 'current', orientationSource: 'sensor',
  orientationStatus: 'active', northCorrection: 0,
  location: { status: 'success', location: { latitude: 35.68, longitude: 139.76, accuracy: 10, timestamp: 0 } },
}

const identity: Matrix3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
const active: DebugMotionState = { status: 'active', updating: true, lastReceivedAt: 1234,
  accelerationIncludingGravity: { x: 0, y: 0, z: -9.8 }, filteredAcceleration: { x: 0, y: 0, z: -9.8 } }
function render(motion: Partial<DebugMotionState> = {}, rotation: Matrix3 | null = identity,
  manual = false, orientationActive = true) {
  return renderToStaticMarkup(<GravityDiagnostics motion={{ ...active, ...motion }} correctedRotation={rotation}
    manualOrientationEnabled={manual} orientationActive={orientationActive} onEnable={vi.fn()} />)
}

describe('gravity diagnostic readout', () => {
  it('両ベクトルと角度差0°、生値、時刻、更新状態を表示する', () => {
    const html = render()
    expect(html).toContain('Gravity sensor')
    expect(html).toContain('Gravity from correctedRotation')
    expect(html).toContain('Gravity difference (°)</dt><dd>0.0000')
    expect(html).toContain('符号比較: 反転なし vs Down (°)</dt><dd>0.0000')
    expect(html).toContain('符号比較: 反転あり vs Down (°)</dt><dd>180.0000')
    expect(html).toContain('センサーに適用する符号</dt><dd>+1（反転なし）')
    expect(html).toContain('accelerationIncludingGravity (m/s²・生値)')
    expect(html).toContain('9.8000')
    expect(html).toContain('加速度センサー更新中</dt><dd>true')
    expect(html).toContain('.234 (端末時刻)')
    expect(html).toContain('重力では方位（yaw）の誤差を検出できません')
  })

  it('W3Cの静止値を無条件にiOSへ合わせず、既定では180°を表示する', () => {
    const html = render({ accelerationIncludingGravity: { x: 0, y: 0, z: 9.8 },
      filteredAcceleration: { x: 0, y: 0, z: 9.8 } })
    expect(html).toContain('Gravity difference (°)</dt><dd>180.0000')
    expect(html).toContain('符号比較: 反転あり vs Down (°)</dt><dd>0.0000')
  })

  const invalidStates: [Partial<DebugMotionState>, string][] = [
    [{ status: 'idle', updating: false, lastReceivedAt: null }, 'データ未取得'],
    [{ status: 'waiting', updating: false, lastReceivedAt: null }, 'データ未取得'],
    [{ status: 'unavailable', updating: false }, '更新停止'],
    [{ status: 'denied', updating: false }, '権限拒否'],
    [{ status: 'error', updating: false }, '権限取得エラー'],
    [{ status: 'unsupported', updating: false }, 'DeviceMotion未対応'],
    [{ accelerationIncludingGravity: { x: null, y: 0, z: 9.8 } }, '欠測または不正値'],
    [{ accelerationIncludingGravity: { x: NaN, y: 0, z: 9.8 } }, '欠測または不正値'],
    [{ accelerationIncludingGravity: { x: 0, y: 0, z: 100 } }, 'ベクトル長が極端'],
    [{ filteredAcceleration: { x: 0, y: 0, z: 0 } }, 'ベクトル長が極端'],
  ]
  it.each(invalidStates)('信用できない状態では角度差を表示せず理由を表示: %s', (state, reason) => {
    const html = render(state)
    expect(html).toContain(`Gravity difference (°)</dt><dd>算出不可:`)
    expect(html).toContain(reason)
    expect(html).not.toContain('Gravity difference (°)</dt><dd>0.0000')
  })

  it('姿勢未更新・未校正・手動姿勢も実機の一致として扱わない', () => {
    expect(render({}, null)).toContain('算出不可: correctedRotation未取得')
    expect(render({}, identity, true)).toContain('算出不可: 手動テストON')
    expect(render({}, identity, false, false)).toContain('算出不可: 姿勢センサーが更新中ではありません')
  })
})

describe('moon path readout', () => {
  it('ARの3D投影とnavigationを表示し、moonInDeviceが正面なら(0.5, 0.5, true)', () => {
    const moon = { azimuth: 0, altitude: 0, isAboveHorizon: true }
    const transform = getMoonDeviceState({ alpha: 0, beta: 90, gamma: 0 }, 0, moon)
    const html = renderToStaticMarkup(<MoonTransformReadout transform={transform} moonPosition={moon} context={context} />)
    expect(html).toContain('moonScreen.x</dt><dd>0.5000')
    expect(html).toContain('moonScreen.y</dt><dd>0.5000')
    expect(html).toContain('moonScreen.visible</dt><dd>true')
    expect(html).toContain('navigation.status</dt><dd>centered')
    expect(html).toContain('navigation.angleToMoon (°)</dt><dd>0.0000')
    expect(html.match(/correctedHeading \(°\)<\/dt>/g)).toHaveLength(1)
  })

  it('天頂・天底ではheadingがnullでもaltitudeを表示する', () => {
    for (const [beta, altitude] of [[0, '-90.0000'], [180, '90.0000']] as const) {
      const transform = getMoonDeviceState({ alpha: 0, beta, gamma: 0 }, 0, null)
      const html = renderToStaticMarkup(<MoonTransformReadout transform={transform} moonPosition={null} context={context} />)
      expect(html).toContain('correctedHeading (°)</dt><dd>null')
      expect(html).toContain(`correctedAltitude (°)</dt><dd>${altitude}`)
    }
  })

  it('背面・画面外も既存projectionの値と状態を隠さず表示する', () => {
    const moon = { azimuth: 180, altitude: 0, isAboveHorizon: false }
    const transform = getMoonDeviceState({ alpha: 0, beta: 90, gamma: 0 }, 0, moon)
    const html = renderToStaticMarkup(<MoonTransformReadout transform={transform} moonPosition={moon} context={context} />)
    expect(html).toContain('moonScreen.visible</dt><dd>false')
    expect(html).toContain('navigation.status</dt><dd>behind')
    expect(html).toContain('navigation.angleToMoon (°)</dt><dd>180.0000')
  })
})
