// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalibrationPage } from './CalibrationPage'

const mocks = vi.hoisted(() => ({
  state: { status: 'active', alpha: 315, beta: 90, gamma: 0, compassHeading: 90 as number | null, message: '' },
  save: vi.fn(), request: vi.fn(),
}))
vi.mock('../hooks/useDeviceOrientation', () => ({ useDeviceOrientation: () => ({ state: mocks.state, requestPermission: mocks.request }) }))
vi.mock('../hooks/useNorthCalibration', () => ({ useNorthCalibration: () => ({ saveNorthCalibration: mocks.save }) }))

let root: Root
let container: HTMLDivElement
let now: number
const navigate = vi.fn()
async function sample(ms = 100, beta = 90, compassHeading: number | null = 90) {
  now += ms
  mocks.state = { ...mocks.state, beta, compassHeading }
  await act(async () => root.render(<CalibrationPage navigate={navigate} />))
}
async function hold() {
  for (let i = 0; i < 7; i++) await sample()
}
beforeEach(async () => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  mocks.state = { status: 'active', alpha: 315, beta: 90, gamma: 0, compassHeading: 90, message: '' }
  mocks.save.mockClear()
  mocks.request.mockClear()
  navigate.mockClear()
  container = document.createElement('div')
  root = createRoot(container)
  await act(async () => root.render(<CalibrationPage navigate={navigate} />))
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('automatic calibration', () => {
  it('saves the existing correction after 700ms of continuous samples and navigates after 600ms', async () => {
    for (let i = 0; i < 6; i++) await sample()
    expect(mocks.save).not.toHaveBeenCalled()
    await sample()
    expect(mocks.save).toHaveBeenCalledTimes(1)
    expect(mocks.save.mock.calls[0][0].northCorrection).toBeCloseTo(-45)
    expect(container.textContent).toContain('準備完了')
    expect(navigate).not.toHaveBeenCalled()
    await sample()
    expect(mocks.save).toHaveBeenCalledTimes(1)
    await act(async () => vi.advanceTimersByTime(599))
    expect(navigate).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTime(1))
    expect(navigate).toHaveBeenCalledWith('/ar')
    expect(container.querySelector('a[href="/ar"]')).toBeNull()
    expect(container.textContent).not.toContain('北基準を保存')
  })
  it('a single qualifying frame never completes', async () => {
    await act(async () => vi.advanceTimersByTime(5000))
    expect(mocks.save).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
  it('resets when horizontalLength falls below 0.9', async () => {
    for (let i = 0; i < 6; i++) await sample()
    await sample(100, 60)
    expect(container.textContent).not.toContain('準備完了')
    await sample()
    for (let i = 0; i < 6; i++) await sample()
    expect(mocks.save).not.toHaveBeenCalled()
    await sample()
    expect(mocks.save).toHaveBeenCalledTimes(1)
  })
  it('requires compass data throughout the hold', async () => {
    for (let i = 0; i < 10; i++) await sample(100, 90, null)
    expect(mocks.save).not.toHaveBeenCalled()
    expect(container.textContent).not.toContain('準備完了')
    await sample()
    await hold()
    expect(mocks.save).toHaveBeenCalledTimes(1)
  })
  it('resets the hold after a gap in sensor samples', async () => {
    for (let i = 0; i < 6; i++) await sample()
    await sample(300)
    expect(mocks.save).not.toHaveBeenCalled()
    await hold()
    expect(mocks.save).toHaveBeenCalledTimes(1)
  })
  it('cancels navigation when the page is unmounted', async () => {
    await hold()
    await act(async () => root.unmount())
    await act(async () => vi.advanceTimersByTime(1000))
    expect(navigate).not.toHaveBeenCalled()
    root = createRoot(container)
  })
})
