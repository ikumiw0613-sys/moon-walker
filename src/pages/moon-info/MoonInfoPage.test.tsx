// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ObservationTimeContext } from '../../shared/time/ObservationTimeContext'
import { MoonInfoPage } from './MoonInfoPage'
import type { LocationState } from '../../features/geolocation/types'

function render(date: string, state: LocationState) {
  const container = document.createElement('div')
  container.innerHTML = renderToStaticMarkup(
    <ObservationTimeContext.Provider value={{ now: new Date(date), mode: 'fixed', setMode: () => {} }}>
      <MoonInfoPage navigate={() => {}} state={state} requestLocation={async () => {}} />
    </ObservationTimeContext.Provider>,
  )
  return container
}

describe('MoonInfoPage', () => {
  it('現在地がなくても月齢と距離を表示し、方位と高度は未取得として扱う', () => {
    const container = render('2026-10-12T08:00:00Z', { status: 'error', message: '位置情報を許可してください' })
    const values = [...container.querySelectorAll('dd')].map(node => node.textContent)
    expect(values.slice(0, 2)).toEqual(['—°', '—°'])
    expect(Number.parseFloat(values[2]!)).toBeGreaterThan(1)
    expect(Number(values[4]!.replace(/[^0-9]/g, ''))).toBeGreaterThan(350000)
    expect(container.textContent).toContain('位置情報を許可してください')
    expect(container.textContent).not.toContain('サンプルデータ')
  })

  it('日時と現在地に応じて観測値と月の影を更新する', () => {
    const state: LocationState = { status: 'success', location: { latitude: 35.6812, longitude: 139.7671, accuracy: 10, timestamp: 0 } }
    const before = render('2026-10-12T08:00:00Z', state)
    const after = render('2026-10-19T08:00:00Z', state)
    expect(before.querySelector('dd')!.textContent).toBe('240.4°')
    expect(before.querySelectorAll('dd')[1]!.textContent).toBe('6.3°')
    expect(before.querySelector('time')!.dateTime).toBe('2026-10-12T08:00:00.000Z')
    expect(before.querySelector('.moon-shadow')!.getAttribute('d')).not.toBe(after.querySelector('.moon-shadow')!.getAttribute('d'))
    expect(before.querySelector('dl')!.textContent).not.toBe(after.querySelector('dl')!.textContent)
    expect(before.textContent).toContain('テスト日時')
  })
})
