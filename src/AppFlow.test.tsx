// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const requestLocation = vi.fn()
vi.mock('./hooks/useGeolocation', () => ({ useGeolocation: () => ({ state: { status: 'idle' }, requestLocation }) }))
vi.mock('./pages/DebugPage', () => ({ DebugPage: () => <main>DEBUG_PAGE</main> }))

let container: HTMLDivElement
let root: Root

beforeEach(async () => {
  window.history.replaceState(null, '', '/')
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  requestLocation.mockClear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<App />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function clickLink(path: string) {
  const link = container.querySelector<HTMLAnchorElement>(`a[href="${path}"]`)!
  expect(link).not.toBeNull()
  await act(async () => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })))
}

describe('frontend prototype navigation', () => {
  it('準備中はARへ進めず、ARの直接アクセスでも北基準の準備を案内する', async () => {
    expect(container.textContent).toContain('月を探す')
    await clickLink('/calibration')
    expect(window.location.pathname).toBe('/calibration')
    expect(container.textContent).toContain('向きセンサー')
    expect(container.querySelector('a[href="/ar"]')).toBeNull()
    await act(async () => {
      window.history.replaceState(null, '', '/ar')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(window.location.pathname).toBe('/ar')
    expect(container.textContent).toContain('月まで')
    expect(container.textContent).toContain('北基準の準備が必要です')
    expect(container.querySelector('video')).toBeNull()
    expect(requestLocation).not.toHaveBeenCalled()
  })

  it('月の仮データと設定項目をナビゲーションから開ける', async () => {
    await clickLink('/moon-info')
    expect(container.textContent).toContain('サンプルデータ')
    for (const label of ['方位角', '高度', '月齢', '月までの距離']) expect(container.textContent).toContain(label)
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('月の情報')
    await clickLink('/settings')
    for (const label of ['北補正', 'センサー設定', 'AR表示設定']) expect(container.textContent).toContain(label)
    expect(requestLocation).not.toHaveBeenCalled()
  })

  it('popstateによる履歴移動と直接URLの表示に対応する', async () => {
    await clickLink('/calibration')
    await act(async () => {
      window.history.replaceState(null, '', '/moon-info/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(container.textContent).toContain('サンプルデータ')
    await act(async () => {
      window.history.replaceState(null, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(container.textContent).toContain('今夜、月に')
  })
})
