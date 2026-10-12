// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MoonDisc } from './MoonDisc'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function render(markup: React.ReactNode) {
  const container = document.createElement('div')
  container.innerHTML = renderToStaticMarkup(markup)
  return container
}

describe('MoonDisc', () => {
  it('元画像の月の中心と直径を、共通の円盤座標に合わせる', () => {
    const container = render(<MoonDisc />)
    const svg = container.querySelector('svg')!
    const image = svg.querySelector('image')!
    const x = Number(image.getAttribute('x'))
    const y = Number(image.getAttribute('y'))
    const width = Number(image.getAttribute('width'))
    const height = Number(image.getAttribute('height'))

    // 元画像のアルファ値128以上の領域から計測した中心と左右端を確認する。
    expect(svg.getAttribute('viewBox')).toBe('0 0 100 100')
    expect(x + 624.5 / 1254 * width).toBeCloseTo(50, 10)
    expect(y + 602.5 / 1254 * height).toBeCloseTo(50, 10)
    expect(x + 308 / 1254 * width).toBeCloseTo(0, 10)
    expect(x + 941 / 1254 * width).toBeCloseTo(100, 10)
    // 縦横を同じ倍率で配置し、元画像の円盤を引き伸ばさない。
    expect(width / 1254).toBeCloseTo(height / 1254, 10)
  })

  it('画像と月相の影を、同じ円形領域で画像の上に重ねる', () => {
    const container = render(<MoonDisc phase={{ cycleAngle: 90, illuminatedFraction: 0.5 }} />)
    const clip = container.querySelector('clipPath')!
    const circle = clip.querySelector('circle')!
    const layer = container.querySelector('g')!

    expect(circle.getAttribute('cx')).toBe('50')
    expect(circle.getAttribute('cy')).toBe('50')
    expect(circle.getAttribute('r')).toBe('50')
    expect(layer.getAttribute('clip-path')).toBe(`url(#${clip.id})`)
    expect([...layer.children].map(child => child.tagName)).toEqual(['image', 'path'])
    expect(layer.querySelector('.moon-shadow')).not.toBeNull()
  })

  it('表示サイズの異なる月を並べても、同じ座標を使い切り抜き領域のIDが重複しない', () => {
    const container = render(<>
      <div style={{ width: 46, height: 46 }}><MoonDisc /></div>
      <div style={{ width: 32, height: 32 }}><MoonDisc /></div>
    </>)
    const discs = [...container.querySelectorAll('svg')]
    const clipIds = discs.map(disc => disc.querySelector('clipPath')!.id)

    expect(new Set(clipIds).size).toBe(2)
    expect(discs.map(disc => disc.getAttribute('viewBox'))).toEqual(['0 0 100 100', '0 0 100 100'])
    discs.forEach((disc, index) => {
      expect(disc.querySelector('g')!.getAttribute('clip-path')).toBe(`url(#${clipIds[index]})`)
    })
    expect(discs[0]!.querySelector('image')!.outerHTML).toBe(discs[1]!.querySelector('image')!.outerHTML)
  })

  it('サブディレクトリで公開しても、同じ月画像を参照できる', () => {
    vi.stubEnv('BASE_URL', '/preview/')
    const image = render(<MoonDisc />).querySelector('image')!
    expect(image.getAttribute('href')).toBe('/preview/moon-image.png')
  })

  it('月相を変更すると画像の位置を保って影を更新し、満月では影を外す', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const container = document.createElement('div')
    const root = createRoot(container)
    try {
      await act(async () => root.render(<MoonDisc phase={{ cycleAngle: 90, illuminatedFraction: 0.5 }} />))
      const image = container.querySelector('image')!
      const imageMarkup = image.outerHTML
      const clipId = container.querySelector('clipPath')!.id
      const firstQuarterPath = container.querySelector('.moon-shadow')!.getAttribute('d')

      await act(async () => root.render(<MoonDisc phase={{ cycleAngle: 270, illuminatedFraction: 0.5 }} />))
      expect(container.querySelector('.moon-shadow')!.getAttribute('d')).not.toBe(firstQuarterPath)
      expect(container.querySelector('image')).toBe(image)
      expect(image.outerHTML).toBe(imageMarkup)
      expect(container.querySelector('clipPath')!.id).toBe(clipId)

      await act(async () => root.render(<MoonDisc phase={{ cycleAngle: 180, illuminatedFraction: 1 }} />))
      expect(container.querySelector('.moon-shadow')).toBeNull()
      expect(container.querySelector('image')).toBe(image)
    } finally {
      await act(async () => root.unmount())
    }
  })
})
