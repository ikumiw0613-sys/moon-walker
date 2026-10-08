// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DebugPage } from './DebugPage'
import { ARPage } from './ARPage'
import { NorthCalibrationProvider } from '../contexts/NorthCalibrationContext'
import { getMoonPosition } from '../lib/astronomy'
import { getMoonDeviceState } from '../lib/moonDeviceNavigation'
import type { LocationState } from '../types/geolocation'

const mocks = vi.hoisted(() => ({ orientation: {
  alpha: 315 as number | null, beta: 90, gamma: 0, absolute: false, compassHeading: 90 as number | null,
  status: 'active', message: 'センサー取得中',
} }))
vi.mock('../hooks/useDeviceOrientation', () => ({ useDeviceOrientation: () => {
  const raw = { ...mocks.orientation, eventType: 'deviceorientation', receivedAt: Date.now(),
    webkitCompassHeading: mocks.orientation.compassHeading }
  return { state: mocks.orientation, requestPermission: vi.fn(), diagnostics: { lastAccepted: raw, lastReceived: raw } }
} }))

const location: LocationState = { status: 'success', location: { latitude: 35.68, longitude: 139.76, accuracy: 10, timestamp: 0 } }
const now = new Date('2026-10-08T06:00:00+09:00')
const attributes = ['data-corrected-heading', 'data-corrected-rotation', 'data-moon-in-device',
  'data-angle-to-moon', 'data-observation-time', 'data-device-rotation']
let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  mocks.orientation.alpha = 315
  mocks.orientation.compassHeading = 90
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function show(page: 'debug' | 'ar') {
  await act(async () => root.render(<NorthCalibrationProvider>
    {page === 'debug' ? <DebugPage state={location} requestLocation={vi.fn()} />
      : <ARPage navigate={vi.fn()} state={location} requestLocation={vi.fn()} />}
  </NorthCalibrationProvider>))
}
async function click(text: string) {
  const button = [...container.querySelectorAll('button')].find(button => button.textContent?.trim() === text)!
  expect(button).toBeDefined()
  expect(button.disabled).toBe(false)
  await act(async () => button.click())
}
async function useCurrentTime() {
  const select = container.querySelector('select')!
  await act(async () => { select.value = 'current'; select.dispatchEvent(new Event('change', { bubbles: true })) })
}
function snapshot() {
  const main = container.querySelector('main')!
  return Object.fromEntries(attributes.map(attribute => [attribute, main.getAttribute(attribute)]))
}

describe('Debug / AR shared north reference', () => {
  it('太陽プレビューと同じ保存済み補正を使い、同じ時刻・場所・姿勢の全出力が一致する', async () => {
    await show('debug')
    await useCurrentTime()
    await click('北基準を合わせる')
    await click('スマホの向きで操作する')
    const debug = snapshot()
    expect(Number(debug['data-corrected-heading'])).toBeCloseTo(90)
    expect(container.querySelector('#sun-debug-title')!.parentElement!.textContent).toContain('90.0°')
    expect(container.textContent).toContain('視点の方位 / 高度90.0° / -0.0°')
    const moon = getMoonPosition(35.68, 139.76, now)
    const expected = getMoonDeviceState(mocks.orientation, -45, moon)
    expect(JSON.parse(debug['data-corrected-rotation']!)).toEqual(expected.correctedRotation)
    expect(JSON.parse(debug['data-moon-in-device']!)).toEqual(expected.moonInDevice)
    expect(Number(debug['data-angle-to-moon'])).toBeCloseTo(expected.angleToMoon!)
    await show('ar')
    expect(snapshot()).toEqual(debug)
    // A changing live heading is never a second north correction.
    mocks.orientation.compassHeading = 270
    await show('ar')
    expect(snapshot()).toEqual(debug)
    await show('debug')
    await useCurrentTime()
    expect(snapshot()).toEqual(debug)
  })

  it('コンパスがない場合の手動北合わせも共通保存先に入り、ARへ引き継がれる', async () => {
    mocks.orientation.compassHeading = null
    await show('debug')
    await useCurrentTime()
    await click('この方向を北にする')
    const debug = snapshot()
    expect(Number(debug['data-corrected-heading'])).toBeCloseTo(0)
    expect(debug['data-moon-in-device']).not.toBe('null')
    await show('ar')
    expect(snapshot()).toEqual(debug)
  })

  it('PCの手動姿勢も明示的な北合わせ後に共通計算へ入力できる', async () => {
    await show('debug')
    await useCurrentTime()
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    await act(async () => checkbox.click())
    expect(snapshot()['data-corrected-rotation']).toBe('null')
    await click('この方向を北にする')
    expect(Number(snapshot()['data-corrected-heading'])).toBeCloseTo(0)
    expect(snapshot()['data-moon-in-device']).not.toBe('null')
  })

  it('未校正ではどちらも北基準を捏造せず、補正済み値はnullになる', async () => {
    await show('debug')
    await useCurrentTime()
    const debug = snapshot()
    for (const attribute of attributes.slice(0, 4)) expect(debug[attribute]).toBe('null')
    await show('ar')
    expect(snapshot()).toEqual(debug)
    expect(container.textContent).toContain('月を探す準備ができていません')
  })
})
