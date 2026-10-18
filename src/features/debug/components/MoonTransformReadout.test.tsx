// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getMoonDeviceState } from '../../moon-guide/moonDeviceNavigation'
import { getMoonPipelineDiagnostics, formatMoonPipelineDiagnostics } from '../moonPipelineDiagnostics'
import type { MoonPipelineInput } from '../moonPipelineDiagnostics'
import { MoonTransformReadout } from './MoonTransformReadout'

let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
const moon = { azimuth: 0, altitude: 0, isAboveHorizon: true }
const input: MoonPipelineInput = {
  transform: getMoonDeviceState({ alpha: 0, beta: 90, gamma: 0 }, 0, moon), moonPosition: moon,
  context: { observationDate: new Date('2026-10-17T10:00:00+09:00'), timeMode: 'current',
    location: { status: 'success', location: { latitude: 35.68, longitude: 139.76, accuracy: 10, timestamp: 0 } },
    orientationSource: 'sensor', orientationStatus: 'active', northCorrection: 0 },
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.unstubAllGlobals()
})
async function show(props = input) {
  await act(async () => root.render(<MoonTransformReadout {...props} />))
}
async function copy() {
  await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
}
function field(label: string) {
  return [...container.querySelectorAll('dt')].find(dt => dt.textContent === label)?.nextElementSibling?.textContent
}

it('変換チェーンの全段階と本番値を一か所で確認できる', async () => {
  await show()
  expect(container.querySelector('h2')!.textContent).toBe('Moon transform pipeline')
  for (const name of ['Astronomy', 'Device / corrected view', 'Moon world vector', 'Moon in device', 'Projection', 'Navigation', 'MoonSprite']) {
    expect([...container.querySelectorAll('.debug-pipeline-heading')].some(element => element.textContent === name)).toBe(true)
  }
  expect(field('observationTime (UTC)')).toBe('2026-10-17T01:00:00.000Z')
  expect(field('latitude')).toBe('35.68')
  expect(field('moon.isAboveHorizon')).toBe('true')
  expect(field('moonWorld vector length')).toBe('1.00')
  expect(field('moonInDeviceのベクトル長')).toBe('1.00')
  expect(field('projection.depth')).toBe('1.00')
  expect(field('horizontalFov (°)')).toBe('90.00')
  expect(field('verticalFov (°)')).toBe('60.00')
  expect(field('screenX / moonScreen.x')).toBe('0.50')
  expect(field('screenY / moonScreen.y')).toBe('0.50')
  expect(field('navigation.arrow')).toBe('◎')
  expect(field('navigation.message')).toBe('月はここ！')
  expect(container.textContent).toContain('moonInDevice = transpose(correctedRotation) * moonWorld')
  expect(container.querySelector('textarea')!.value).toBe(formatMoonPipelineDiagnostics(getMoonPipelineDiagnostics(input)))
})

it('コピーは表示中の1スナップショットを使い、その後の更新で書き換わらない', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  await show()
  const expected = formatMoonPipelineDiagnostics(getMoonPipelineDiagnostics(input))
  await copy()
  expect(writeText).toHaveBeenCalledExactlyOnceWith(expected)
  expect(container.textContent).toContain('コピーしました')
  await show({ ...input, context: { ...input.context, observationDate: new Date('2026-10-17T01:01:00Z') } })
  expect(field('observationTime (UTC)')).toBe('2026-10-17T01:01:00.000Z')
  expect(container.querySelector('textarea')!.value).toBe(expected)
  expect(container.textContent).toContain('固定スナップショット')
})

it.each(['missing', 'denied'] as const)('Clipboard APIが%sでも選択可能な診断テキストを残す', async mode => {
  vi.stubGlobal('navigator', mode === 'missing' ? {} : { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) } })
  await show()
  await copy()
  expect(container.textContent).toContain('下のテキストを選択してコピーしてください')
  expect(container.querySelector('textarea')!.readOnly).toBe(true)
  expect(container.querySelector('textarea')!.value).toContain('screenX: 0.5')
})

it('背面・地平線下・更新停止はprojectionと描画資格を区別して表示する', async () => {
  const below = { ...moon, isAboveHorizon: false }
  await show({ ...input, moonPosition: below, transform: getMoonDeviceState({ alpha: 0, beta: 90, gamma: 0 }, 0, below) })
  expect(field('visible / moonScreen.visible')).toBe('true')
  expect(container.textContent).toContain('moon below horizon')
  await show({ ...input, context: { ...input.context, orientationStatus: 'unavailable' } })
  expect(container.textContent).toContain('orientation inactive (AR withholds correctedRotation)')
  expect(field('projection.depth')).toBe('1.00')
  const behind = { ...moon, azimuth: 180 }
  await show({ ...input, moonPosition: behind, transform: getMoonDeviceState({ alpha: 0, beta: 90, gamma: 0 }, 0, behind) })
  expect(field('visible / moonScreen.visible')).toBe('false')
  expect(field('projection.normalizedX')).toBe('null')
  expect(container.textContent).toContain('behind camera')
})
