// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ObservationTimeProvider } from './ObservationTimeProvider'
import { useObservationTime } from './useObservationTime'

function Clock({ controls = false }: { controls?: boolean }) {
  const { now, mode, changeMode } = useObservationTime()
  return <div><output>{now.toISOString()}</output><span>{mode}</span>
    {controls && <><button onClick={() => changeMode('fixed')}>fixed</button>
      <button onClick={() => changeMode('current')}>current</button></>}
  </div>
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
async function show(page: string) {
  await act(async () => root.render(<ObservationTimeProvider><Clock key={page} controls={page === 'calibration'} /></ObservationTimeProvider>))
}
async function click(text: string) {
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === text)!.click())
}
const time = () => container.querySelector('output')!.textContent
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-12T00:00:00Z'))
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('選択したテスト日時を画面移動後も保持し、現在時刻に戻すと即時更新する', async () => {
  await show('calibration')
  expect(time()).toBe('2026-10-12T00:00:00.000Z')
  await click('fixed')
  await show('ar')
  await act(async () => vi.advanceTimersByTime(30000))
  expect(time()).toBe('2026-10-11T01:00:00.000Z')
  await show('home')
  expect(time()).toBe('2026-10-11T01:00:00.000Z')
  await show('calibration')
  await click('current')
  expect(time()).toBe('2026-10-12T00:00:30.000Z')
  await act(async () => vi.advanceTimersByTime(10000))
  expect(time()).toBe('2026-10-12T00:00:40.000Z')
})

it('復帰時に更新し、再読み込み相当の再マウントでは現在時刻から始まる', async () => {
  await show('calibration')
  vi.setSystemTime(new Date('2026-10-12T01:00:00Z'))
  await act(async () => window.dispatchEvent(new Event('focus')))
  expect(time()).toBe('2026-10-12T01:00:00.000Z')
  await click('fixed')
  await act(async () => root.unmount())
  expect(vi.getTimerCount()).toBe(0)
  root = createRoot(container)
  await show('ar')
  expect(time()).toBe('2026-10-12T01:00:00.000Z')
})

it('時間をずらして複数の画面部品を描画しても、一つの時計と観測時刻を共有する', async () => {
  const setInterval = vi.spyOn(window, 'setInterval')
  await act(async () => root.render(<ObservationTimeProvider><Clock key="first" /></ObservationTimeProvider>))
  await act(async () => vi.advanceTimersByTime(5000))
  await act(async () => root.render(<ObservationTimeProvider>
    <Clock key="first" /><Clock key="second" />
  </ObservationTimeProvider>))
  expect([...container.querySelectorAll('output')].map(output => output.textContent))
    .toEqual(['2026-10-12T00:00:00.000Z', '2026-10-12T00:00:00.000Z'])
  expect(setInterval).toHaveBeenCalledTimes(1)
  await act(async () => vi.advanceTimersByTime(5000))
  expect([...container.querySelectorAll('output')].map(output => output.textContent))
    .toEqual(['2026-10-12T00:00:10.000Z', '2026-10-12T00:00:10.000Z'])
})

it('固定日時から現在時刻への切替を、すべての画面部品に即時反映する', async () => {
  await act(async () => root.render(<ObservationTimeProvider>
    <Clock controls /><Clock />
  </ObservationTimeProvider>))
  await click('fixed')
  vi.setSystemTime(new Date('2026-10-12T04:00:00Z'))
  await click('current')
  expect([...container.querySelectorAll('output')].map(output => output.textContent))
    .toEqual(['2026-10-12T04:00:00.000Z', '2026-10-12T04:00:00.000Z'])
})
