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
