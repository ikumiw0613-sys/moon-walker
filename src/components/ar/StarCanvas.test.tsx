// @vitest-environment jsdom
import { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StarCanvas } from './StarCanvas'

let root: ReturnType<typeof createRoot>
let frames: Map<number, FrameRequestCallback>
let nextFrameId: number
let width: number
let height: number
let random: ReturnType<typeof vi.spyOn>
const context = {
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fillStyle: '',
  fill: vi.fn(),
}
let opacities: number[]

function drawFrame(timestamp: number) {
  context.arc.mockClear()
  opacities = []
  const [id, callback] = [...frames.entries()][0]
  frames.delete(id)
  callback(timestamp)
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  frames = new Map()
  nextFrameId = 0
  width = 400
  height = 800
  opacities = []
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = ++nextFrameId
    frames.set(id, callback)
    return id
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)))
  vi.spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get').mockImplementation(() => width)
  vi.spyOn(HTMLCanvasElement.prototype, 'clientHeight', 'get').mockImplementation(() => height)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  let seed = 0
  random = vi.spyOn(Math, 'random').mockImplementation(() => (++seed * 37 % 101) / 101)
  context.fill.mockImplementation(() => {
    opacities.push(Number(context.fillStyle.match(/, ([\d.]+)\)$/)![1]))
  })
  root = createRoot(document.createElement('div'))
})

afterEach(async () => {
  await act(async () => root.unmount())
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

it('twinkles independently without regenerating stars or restarting the loop on parallax updates', async () => {
  await act(async () => root.render(<StarCanvas />))
  drawFrame(1000)
  const initialPositions = [...context.arc.mock.calls]
  const initialOpacities = [...opacities]
  const randomCalls = random.mock.calls.length
  const requestedFrames = nextFrameId
  expect(initialPositions).toHaveLength(130)
  expect(new Set(initialOpacities.slice(0, 70)).size).toBeGreaterThan(1)

  await act(async () => root.render(<StarCanvas offsetX={-120} offsetY={80} />))
  expect(nextFrameId).toBe(requestedFrames)
  expect(random).toHaveBeenCalledTimes(randomCalls)
  drawFrame(4000)
  expect(frames.size).toBe(1)

  const layers = [
    { start: 0, end: 70, speed: 0.15, min: 0.31, max: 0.39 },
    { start: 70, end: 110, speed: 0.35, min: 0.47, max: 0.63 },
    { start: 110, end: 130, speed: 0.65, min: 0.66, max: 0.94 },
  ]
  for (const layer of layers) {
    const [oldX, oldY, radius] = initialPositions[layer.start]
    const [x, y, nextRadius] = context.arc.mock.calls[layer.start]
    expect(x).toBeCloseTo(((oldX - 120 * layer.speed) % width + width) % width)
    expect(y).toBeCloseTo(((oldY + 80 * layer.speed) % height + height) % height)
    expect(nextRadius).toBe(radius)
    const values = opacities.slice(layer.start, layer.end)
    expect(values.every(value => value >= layer.min && value <= layer.max)).toBe(true)
    expect(values.some((value, i) => value !== initialOpacities[layer.start + i])).toBe(true)
  }
})

it('keeps one animation loop in StrictMode and cancels the pending frame on unmount', async () => {
  const removeListener = vi.spyOn(window, 'removeEventListener')
  await act(async () => root.render(<StrictMode><StarCanvas /></StrictMode>))
  expect(frames.size).toBe(1)
  drawFrame(1000)
  const pendingFrame = [...frames.keys()][0]
  await act(async () => root.unmount())
  expect(window.cancelAnimationFrame).toHaveBeenLastCalledWith(pendingFrame)
  expect(frames.size).toBe(0)
  expect(removeListener).toHaveBeenCalledWith('resize', expect.any(Function))
  root = createRoot(document.createElement('div'))
})

it('resumes drawing after resizing a zero-sized canvas', async () => {
  width = 0
  height = 0
  await act(async () => root.render(<StarCanvas />))
  drawFrame(1000)
  expect(context.arc).not.toHaveBeenCalled()
  expect(frames.size).toBe(1)

  width = 400
  height = 800
  window.dispatchEvent(new Event('resize'))
  drawFrame(2000)
  expect(context.arc).toHaveBeenCalledTimes(130)
  expect(context.arc.mock.calls.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true)
})
