// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Matrix3 } from '../../../shared/math/types'
import type { DebugMotionState } from '../useDebugDeviceMotion'
import { GravityDiagnostics } from './GravityDiagnostics'

let root: ReturnType<typeof createRoot>
let container: HTMLDivElement
const identity: Matrix3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
const iosFaceUp: DebugMotionState = { status: 'active', updating: true, lastReceivedAt: 1000,
  accelerationIncludingGravity: { x: 0, y: 0, z: -9.8 }, filteredAcceleration: { x: 0, y: 0, z: -9.8 } }

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.unstubAllGlobals()
})
async function show(motion = iosFaceUp, rotation = identity) {
  await act(async () => root.render(<GravityDiagnostics motion={motion} correctedRotation={rotation}
    manualOrientationEnabled={false} orientationActive onEnable={vi.fn()} />))
}
async function selectSign(value: string) {
  const select = container.querySelector('select')!
  await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })) })
}
function read(label: string) {
  return [...container.querySelectorAll('dt')].find(dt => dt.textContent === label)?.nextElementSibling?.textContent
}

it('iPhone/Safari既定は反転なし、切替時は符号だけ変え、両候補は固定する', async () => {
  await show()
  expect(container.querySelector('select')!.value).toBe('raw-is-down')
  expect(read('Gravity difference (°)')).toBe('0.00')
  await selectSign('raw-is-up')
  expect(read('Gravity difference (°)')).toBe('180.00')
  expect(read('符号比較: 反転なし vs Down (°)')).toBe('0.00')
  expect(read('符号比較: 反転あり vs Down (°)')).toBe('180.00')
  await selectSign('raw-is-down')
  expect(read('Gravity difference (°)')).toBe('0.00')
  expect(identity).toEqual([[1, 0, 0], [0, 1, 0], [0, 0, 1]])
  expect(iosFaceUp.accelerationIncludingGravity).toEqual({ x: 0, y: 0, z: -9.8 })
})

it('姿勢が逆になっても角度差の小さい符号を自動採用しない', async () => {
  await show()
  await show(iosFaceUp, [[1, 0, 0], [0, -1, 0], [0, 0, -1]])
  expect(container.querySelector('select')!.value).toBe('raw-is-down')
  expect(read('Gravity difference (°)')).toBe('180.00')
})

it('更新停止では両符号の角度比較も停止し、古い値を正常と見せない', async () => {
  await show()
  await selectSign('raw-is-up')
  await show({ ...iosFaceUp, status: 'unavailable', updating: false })
  for (const label of ['Gravity difference (°)', '符号比較: 反転なし vs Down (°)', '符号比較: 反転あり vs Down (°)']) {
    expect(read(label)).toContain('算出不可: 加速度センサーの更新停止')
  }
})
