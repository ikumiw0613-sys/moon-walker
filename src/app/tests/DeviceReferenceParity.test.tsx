// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DebugPage } from '../../pages/debug/DebugPage'
import { ARPage } from '../../pages/ar/ARPage'
import { NorthCalibrationProvider } from '../../features/north-calibration/NorthCalibrationProvider'
import { getMoonPosition } from '../../features/moon/astronomy'
import * as astronomy from '../../features/moon/astronomy'
import { getMoonDeviceState } from '../../features/moon-guide/moonDeviceNavigation'
import type { LocationState } from '../../features/geolocation/types'

const mocks = vi.hoisted(() => ({ orientation: {
  alpha: 315 as number | null, beta: 90, gamma: 0, absolute: false, compassHeading: 90 as number | null,
  status: 'active', message: 'センサー取得中',
} }))
vi.mock('../../features/device-orientation/useDeviceOrientation', () => ({ useDeviceOrientation: () => {
  const raw = { ...mocks.orientation, eventType: 'deviceorientation', receivedAt: Date.now(),
    webkitCompassHeading: mocks.orientation.compassHeading }
  return { state: mocks.orientation, requestPermission: vi.fn(), diagnostics: { lastAccepted: raw, lastReceived: raw } }
} }))

const location: LocationState = { status: 'success', location: { latitude: 35.68, longitude: 139.76, accuracy: 10, timestamp: 0 } }
const now = new Date('2026-10-11T10:00:00+09:00')
const attributes = ['data-corrected-heading', 'data-corrected-rotation', 'data-moon-in-device',
  'data-angle-to-moon', 'data-observation-time', 'data-device-rotation']
let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('DeviceMotionEvent', {})
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
  vi.restoreAllMocks()
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
  it('pipelineの最終座標がARのMoonSpriteへ同じ値で渡り、診断追加で描画経路を変えない', async () => {
    vi.spyOn(astronomy, 'getMoonPosition').mockReturnValue({ azimuth: 90, altitude: 0, isAboveHorizon: true })
    await show('debug')
    await useCurrentTime()
    await click('北基準を合わせる')
    const debug = snapshot()
    const text = container.querySelector<HTMLTextAreaElement>('[aria-labelledby="results-title"] textarea')!.value
    const values = Object.fromEntries(text.split('\n').slice(1).map(line => {
      const separator = line.indexOf(': ')
      return [line.slice(0, separator), line.slice(separator + 2)]
    }))
    expect(values['moon.azimuth']).toBe('90')
    expect(values['visible']).toBe('true')
    expect(values['navigation.status']).toBe('centered')
    expect(Number(values['screenX'])).toBeCloseTo(0.5)
    expect(Number(values['screenY'])).toBeCloseTo(0.5)
    await show('ar')
    expect(snapshot()).toEqual(debug)
    const sprite = container.querySelector<HTMLElement>('.moon-sprite')!
    expect(sprite).not.toBeNull()
    expect(sprite.style.left).toBe(`${Number(values.screenX) * 100}%`)
    expect(sprite.style.top).toBe(`${Number(values.screenY) * 100}%`)
    expect(container.querySelector('#results-title')).toBeNull()
  })

  it('Debugの加速度を変えても保存済み北補正とAR共通の月・姿勢出力は変わらない', async () => {
    await show('debug')
    await useCurrentTime()
    await click('北基準を合わせる')
    const before = snapshot()
    await click('加速度センサーを有効にする（Debug専用）')
    const sign = container.querySelector<HTMLSelectElement>('[aria-labelledby="gravity-title"] select')!
    for (const value of ['raw-is-down', 'raw-is-up', 'raw-is-down']) {
      await act(async () => { sign.value = value; sign.dispatchEvent(new Event('change', { bubbles: true })) })
      expect(snapshot()).toEqual(before)
      expect(container.textContent).toContain('saved northCorrection-45.0°')
    }
    for (const sample of [{ x: 0, y: 9.8, z: 0 }, { x: 9.8, y: 0, z: 0 }, null]) {
      await act(async () => window.dispatchEvent(Object.assign(new Event('devicemotion'), { accelerationIncludingGravity: sample })))
      expect(snapshot()).toEqual(before)
      expect(container.textContent).toContain('saved northCorrection-45.0°')
    }
    expect(container.textContent).toContain('算出不可: データ未取得')
    await show('ar')
    expect(snapshot()).toEqual(before)
    expect(container.querySelector('#gravity-title')).toBeNull()
  })

  it('太陽プレビューと同じ保存済み補正を使い、同じ時刻・場所・姿勢の全出力が一致する', async () => {
    await show('debug')
    await useCurrentTime()
    await click('北基準を合わせる')
    await click('スマホの向きで操作する')
    const debug = snapshot()
    expect(Number(debug['data-corrected-heading'])).toBeCloseTo(90)
    expect(container.querySelector('#sun-debug-title')).not.toBeNull()
    expect(container.querySelector('[aria-labelledby="device-pose-title"]')!.textContent).toContain('correctedHeading (°)90.00')
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
