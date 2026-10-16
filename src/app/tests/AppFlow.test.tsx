// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import type { LocationState } from '../../features/geolocation/types'

const requestLocation = vi.fn()
const mocks = vi.hoisted(() => ({ state: { status: 'idle' } as LocationState, above: false }))
vi.mock('../../features/geolocation/useGeolocation', () => ({ useGeolocation: () => ({ state: mocks.state, requestLocation }) }))
vi.mock('../../features/moon/astronomy', () => ({
  getMoonPosition: () => ({ isAboveHorizon: mocks.above }),
  getNextMoonrise: () => new Date(2026, 9, 11, 18, 30),
}))
vi.mock('../../pages/debug/DebugPage', () => ({ DebugPage: () => <main>DEBUG_PAGE</main> }))

let container: HTMLDivElement
let root: Root

beforeEach(async () => {
  window.history.replaceState(null, '', '/')
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  requestLocation.mockClear()
  mocks.state = { status: 'idle' }
  mocks.above = false
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<App />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function clickLink(path: string) {
  const link = container.querySelector<HTMLAnchorElement>(`a[href="${path}"]`)!
  expect(link).not.toBeNull()
  await act(async () => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })))
}

async function updateMoon(above: boolean) {
  mocks.above = above
  mocks.state = { status: 'success', location: { latitude: 35, longitude: 139, accuracy: 10, timestamp: 0 } }
  await act(async () => root.render(<App />))
}

describe('frontend prototype navigation', () => {
  it('準備中はARへ進めず、ARの直接アクセスでも北基準の準備を案内する', async () => {
    expect(container.textContent).toContain('現在地の月を確認しています')
    await updateMoon(true)
    expect(window.location.pathname).toBe('/calibration')
    expect(container.textContent).toContain('向きセンサー')
    expect(container.querySelector('a[href="/ar"]')).toBeNull()
    await act(async () => {
      window.history.replaceState(null, '', '/ar')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(window.location.pathname).toBe('/ar')
    expect(container.textContent).not.toContain('月まで')
    expect(container.textContent).toContain('月を探す準備ができていません')
    expect(container.querySelector('video')).toBeNull()
    expect(requestLocation).toHaveBeenCalledTimes(1)
  })

  it('月の観測データと設定項目をナビゲーションから開ける', async () => {
    await clickLink('/moon-info')
    expect(container.textContent).toContain('観測日時')
    for (const label of ['方位角', '高度', '月齢', '月までの距離']) expect(container.textContent).toContain(label)
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('月の情報')
    await clickLink('/settings')
    for (const label of ['北補正', 'センサー設定', 'AR表示設定']) expect(container.textContent).toContain(label)
    // モックの状態はidleのままなので、月の情報画面でも取得を要求する。
    expect(requestLocation).toHaveBeenCalledTimes(2)
  })

  it('popstateによる履歴移動と直接URLの表示に対応する', async () => {
    await act(async () => {
      window.history.replaceState(null, '', '/calibration')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await act(async () => {
      window.history.replaceState(null, '', '/moon-info/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(container.textContent).toContain('観測日時')
    await act(async () => {
      window.history.replaceState(null, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(container.textContent).toContain('現在地の月を確認しています')
  })

  it('月が出ていない間はホームで待機し、10秒ごとの更新で月が出たら自動遷移する', async () => {
    vi.useFakeTimers()
    // Remount so the waiting page's interval uses the fake clock.
    await act(async () => root.unmount())
    root = createRoot(container)
    await updateMoon(false)
    expect(window.location.pathname).toBe('/')
    expect(container.textContent).toContain('今は月が見えません')
    expect(container.textContent).toContain('次に見えるのは')
    expect(container.querySelector('a[href="/calibration"]')).toBeNull()
    const historyLength = window.history.length
    mocks.above = true
    await act(async () => vi.advanceTimersByTime(10000))
    expect(window.location.pathname).toBe('/calibration')
    expect(container.textContent).toContain('向きセンサー')
    expect(window.history.length).toBe(historyLength)
  })

  it('画面に戻ったときも月の状態を再判定して遷移する', async () => {
    await updateMoon(false)
    mocks.above = true
    await act(async () => window.dispatchEvent(new Event('focus')))
    expect(window.location.pathname).toBe('/calibration')
  })

  it('位置情報を取得できない場合は待機ページで再取得を案内する', async () => {
    mocks.state = { status: 'error', message: '位置情報を許可してください。' }
    await act(async () => root.render(<App />))
    expect(window.location.pathname).toBe('/')
    expect(container.textContent).toContain('位置情報を許可してください。')
    const retry = container.querySelector<HTMLButtonElement>('button')!
    await act(async () => retry.click())
    expect(requestLocation).toHaveBeenCalledTimes(2)
  })
})
