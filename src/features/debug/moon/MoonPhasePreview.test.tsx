// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MoonPhasePreview } from './MoonPhasePreview'
import { ObservationTimeProvider } from '../../../shared/time/ObservationTimeProvider'
import { useObservationTime } from '../../../shared/time/useObservationTime'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<MoonPhasePreview />))
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function click(label: string) {
  const button = [...container.querySelectorAll('button')].find(button => button.textContent === label)!
  expect(button).toBeDefined()
  await act(async () => button.click())
}
async function slide(angle: number) {
  const slider = container.querySelector<HTMLInputElement>('input[type="range"]')!
  // Reactの値追跡を迂回し、ブラウザーでスライダーを操作したときと同じ変更を送る。
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(slider, String(angle))
    slider.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const selected = () => container.querySelector('.moon-phase-preview__selected')!

it('代表的な8つの月相を、拡大・AR本体・マーカーのサイズで並べる', () => {
  const figures = [...container.querySelectorAll('figure')]
  expect(figures.map(figure => figure.getAttribute('aria-label'))).toEqual([
    '新月', '満ちる三日月', '上弦', '満月へ向かう月', '満月', '欠け始めた月', '下弦', '欠ける三日月',
  ])
  for (const figure of figures) {
    const discs = [...figure.querySelectorAll<HTMLElement>('.moon-phase-preview__disc')]
    expect(discs.map(disc => disc.style.width)).toEqual(['96px', '46px', '32px'])
    expect(discs.map(disc => disc.style.height)).toEqual(['96px', '46px', '32px'])
    const shadows = discs.map(disc => disc.querySelector('.moon-shadow')?.getAttribute('d') ?? null)
    expect(new Set(shadows).size).toBe(1)
    expect(discs.every(disc => disc.querySelector('image')?.getAttribute('href') === '/moon-image.png')).toBe(true)
  }
  const ids = [...container.querySelectorAll('clipPath')].map(clip => clip.id)
  expect(new Set(ids).size).toBe(ids.length)
})

it('プリセットを選ぶと影が更新され、満月では3サイズとも影が消える', async () => {
  const images = [...selected().querySelectorAll('image')]
  const firstQuarter = selected().querySelector('.moon-shadow')!.getAttribute('d')
  await click('下弦')
  expect(selected().querySelector('.moon-shadow')!.getAttribute('d')).not.toBe(firstQuarter)
  expect([...selected().querySelectorAll('image')]).toEqual(images)
  await click('満月')
  expect(selected().querySelectorAll('.moon-shadow')).toHaveLength(0)
  expect(selected().querySelectorAll('image')).toHaveLength(3)
  expect(container.querySelector('output')!.textContent).toContain('100.0000%')
})

it('スライダーの0°と360°が同じ新月になり、中間の月相も確認できる', async () => {
  await slide(0)
  const newMoon = selected().querySelector('.moon-shadow')!.getAttribute('d')
  await slide(45)
  expect(selected().querySelector('.moon-shadow')!.getAttribute('d')).not.toBe(newMoon)
  expect(container.querySelector('output')!.textContent).toContain('45.0°')
  await slide(360)
  expect(selected().querySelector('.moon-shadow')!.getAttribute('d')).toBe(newMoon)
  expect(container.querySelector('output')!.textContent).toBe('0.0° ／ 照明率 0.0000%')
})

it('半月の境界前後を切り替えても、画像と切り抜き領域を再作成しない', async () => {
  const image = selected().querySelector('image')!
  const clipId = selected().querySelector('clipPath')!.id
  for (const label of ['89.9°', '90°', '90.1°', '269.9°', '270°', '270.1°']) {
    await click(label)
    const path = selected().querySelector('.moon-shadow')!.getAttribute('d')!
    expect(path).not.toMatch(/NaN|Infinity/)
    expect(selected().querySelector('image')).toBe(image)
    expect(selected().querySelector('clipPath')!.id).toBe(clipId)
  }
})

it('連続再生で月相が進み、停止とアンマウントで再生処理を解除する', async () => {
  const frames = new Map<number, FrameRequestCallback>()
  let nextId = 0
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    frames.set(++nextId, callback)
    return nextId
  })
  const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id) })
  const tick = async (time: number) => {
    const [id, callback] = frames.entries().next().value!
    frames.delete(id)
    await act(async () => callback(time))
  }
  await click('連続再生')
  await tick(0)
  await tick(100)
  expect(container.querySelector('output')!.textContent).toContain('93.0°')
  await click('停止')
  expect(frames.size).toBe(0)
  expect(cancel).toHaveBeenCalled()
  await click('連続再生')
  await act(async () => root.render(null))
  expect(frames.size).toBe(0)
})

it('プレビューの操作が、AR用の固定日時や時刻モードを変更しない', async () => {
  function Clock() {
    const { now, mode, changeMode } = useObservationTime()
    return <><span data-clock>{mode}:{now.toISOString()}</span>
      <button onClick={() => changeMode('fixed')}>固定日時にする</button></>
  }
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-12T00:00:00Z'))
  await act(async () => root.render(<ObservationTimeProvider><Clock /><MoonPhasePreview /></ObservationTimeProvider>))
  await click('固定日時にする')
  const observationTime = container.querySelector('[data-clock]')!.textContent
  await click('下弦')
  await slide(45)
  expect(container.querySelector('[data-clock]')!.textContent).toBe(observationTime)
})
