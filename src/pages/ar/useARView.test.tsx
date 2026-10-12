// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMoonPosition } from '../../features/moon/astronomy'
import { getMoonPhase } from '../../features/moon/moonPhase'
import type { LocationState } from '../../features/geolocation/types'
import { ObservationTimeProvider } from '../../shared/time/ObservationTimeProvider'
import { useObservationTime } from '../../shared/time/useObservationTime'
import { useARView } from './useARView'

vi.mock('../../features/device-orientation/useDeviceOrientation', () => ({
  useDeviceOrientation: () => ({
    state: { alpha: 0, beta: 90, gamma: 0, compassHeading: null, status: 'active', message: '' },
    requestPermission: vi.fn(),
  }),
}))
vi.mock('../../features/north-calibration/useNorthCalibration', () => ({
  useNorthCalibration: () => ({ calibrated: true, northCorrection: 0 }),
}))
vi.mock('../../features/moon/astronomy', () => ({
  getMoonPosition: vi.fn(() => ({ azimuth: 0, altitude: 10, isAboveHorizon: true })),
}))
vi.mock('../../features/moon/moonPhase', async importOriginal => {
  const original = await importOriginal<typeof import('../../features/moon/moonPhase')>()
  return { ...original, getMoonPhase: vi.fn(original.getMoonPhase) }
})

const location: LocationState = { status: 'success', location: { latitude: 35.68, longitude: 139.76, accuracy: 10, timestamp: 0 } }

function Probe({ state }: { state: LocationState }) {
  const { now, moonPhase } = useARView(state)
  const { changeMode } = useObservationTime()
  return <>
    <output data-kind="time">{now.toISOString()}</output>
    <output data-kind="phase">{JSON.stringify(moonPhase)}</output>
    <button onClick={() => changeMode('fixed')}>fixed</button>
    <button onClick={() => changeMode('current')}>current</button>
  </>
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-12T00:00:00Z'))
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.clearAllMocks()
  container = document.createElement('div')
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function show(state: LocationState = location) {
  await act(async () => root.render(<ObservationTimeProvider><Probe state={state} /></ObservationTimeProvider>))
}
async function click(label: string) {
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === label)!.click())
}
function assertSharedTime(expected: string) {
  const phaseTime = vi.mocked(getMoonPhase).mock.calls.at(-1)![0]
  const positionTime = vi.mocked(getMoonPosition).mock.calls.at(-1)![2]
  expect(phaseTime).toBe(positionTime)
  expect(phaseTime.toISOString()).toBe(expected)
  expect(container.querySelector('[data-kind="time"]')!.textContent).toBe(expected)
}

describe('useARViewの観測時刻', () => {
  it('月の位置と月相に同じ日時を渡し、10秒ごとに両方を更新する', async () => {
    await show()
    assertSharedTime('2026-10-12T00:00:00.000Z')
    const initialPhase = container.querySelector('[data-kind="phase"]')!.textContent
    await act(async () => vi.advanceTimersByTime(10000))
    assertSharedTime('2026-10-12T00:00:10.000Z')
    expect(container.querySelector('[data-kind="phase"]')!.textContent).not.toBe(initialPhase)
  })

  it('固定日時で両方の計算を止め、現在時刻に戻すと即時に更新する', async () => {
    await show()
    await click('fixed')
    assertSharedTime('2026-10-11T01:00:00.000Z')
    const fixedPhase = container.querySelector('[data-kind="phase"]')!.textContent
    await act(async () => vi.advanceTimersByTime(60000))
    assertSharedTime('2026-10-11T01:00:00.000Z')
    expect(container.querySelector('[data-kind="phase"]')!.textContent).toBe(fixedPhase)
    await click('current')
    assertSharedTime('2026-10-12T00:01:00.000Z')
  })

  it('画面に復帰したときも、位置と月相を同じ最新時刻で再計算する', async () => {
    await show()
    vi.setSystemTime(new Date('2026-10-12T01:00:00Z'))
    await act(async () => window.dispatchEvent(new Event('focus')))
    assertSharedTime('2026-10-12T01:00:00.000Z')
  })

  it('位置情報がなくても、共有された日時から月相を計算する', async () => {
    await show({ status: 'idle' })
    expect(getMoonPosition).not.toHaveBeenCalled()
    expect(vi.mocked(getMoonPhase).mock.calls.at(-1)![0].toISOString()).toBe('2026-10-12T00:00:00.000Z')
    expect(container.querySelector('[data-kind="phase"]')!.textContent).toContain('illuminatedFraction')
  })
})
