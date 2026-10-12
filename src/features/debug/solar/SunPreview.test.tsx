import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SunPreview } from './SunPreview'

const sun = { azimuth: 0, altitude: 30, isAboveHorizon: true }

describe('SunPreview', () => {
  it('補正済み視点の正面に太陽があれば中央に表示する', () => {
    const html = renderToStaticMarkup(<SunPreview sun={sun} cameraForwardCorrected={{ x: 0, y: Math.cos(Math.PI / 6), z: 0.5 }} />)
    const marker = html.match(/aria-label="太陽" style="left:([\d.]+)%;top:([\d.]+)%"/)
    expect(marker).not.toBeNull()
    expect(Number(marker![1])).toBeCloseTo(50)
    expect(Number(marker![2])).toBeCloseTo(50)
    expect(html).toContain('太陽はここ！')
  })

  it('視野外はマーカーを隠し方向を案内する', () => {
    const html = renderToStaticMarkup(<SunPreview sun={{ ...sun, azimuth: 90 }} cameraForwardCorrected={{ x: 0, y: 1, z: 0 }} />)
    expect(html).not.toContain('aria-label="太陽"')
    expect(html).toContain('右上へ')
  })

  it('未校正・位置未取得・地平線下を扱う', () => {
    expect(renderToStaticMarkup(<SunPreview sun={sun} cameraForwardCorrected={null} />)).toContain('北補正・センサーの取得待ち')
    expect(renderToStaticMarkup(<SunPreview sun={null} cameraForwardCorrected={null} />)).toContain('現在地の取得待ち')
    const html = renderToStaticMarkup(<SunPreview sun={{ ...sun, altitude: -10, isAboveHorizon: false }} cameraForwardCorrected={{ x: 0, y: 1, z: 0 }} />)
    expect(html).toContain('太陽は地平線の下にあります')
    expect(html).not.toContain('aria-label="太陽"')
  })
})
