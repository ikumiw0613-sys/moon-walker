import { useEffect, useState } from 'react'
import { MoonDisc } from '../../moon/components/MoonDisc'
import type { MoonPhaseShape } from '../../moon/types'
import { getPreviewMoonPhase, MOON_PHASE_BOUNDARIES, MOON_PHASE_PRESETS } from './previewMoonPhase'
import './MoonPhasePreview.css'

const PREVIEW_SIZES = [
  { label: '拡大', size: 96 },
  { label: 'AR', size: 46 },
  { label: 'マーカー', size: 32 },
] as const

function MoonSizes({ phase }: { phase: MoonPhaseShape }) {
  return <div className="moon-phase-preview__sizes">
    {PREVIEW_SIZES.map(({ label, size }) => <div key={size} className="moon-phase-preview__size" role="group" aria-label={`${label} ${size}px`}>
      <span className={`moon-phase-preview__disc${size === 32 ? ' moon-phase-preview__disc--marker' : ''}`}
        style={{ width: size, height: size }}>
        <MoonDisc phase={phase} />
      </span>
      <span>{size}px</span>
    </div>)}
  </div>
}

export function MoonPhasePreview() {
  const [angle, setAngle] = useState(90)
  const [playing, setPlaying] = useState(false)
  const phase = getPreviewMoonPhase(angle)

  useEffect(() => {
    if (!playing) return
    let previousTime: number | null = null
    let frameId: number
    const frame = (time: number) => {
      if (previousTime !== null) {
        // 復帰直後の大きな時間差で月相が飛ばないよう、進める時間を制限する。
        const elapsedSeconds = Math.min((time - previousTime) / 1000, 0.1)
        setAngle(current => (current + elapsedSeconds * 30) % 360)
      }
      previousTime = time
      frameId = window.requestAnimationFrame(frame)
    }
    frameId = window.requestAnimationFrame(frame)
    return () => window.cancelAnimationFrame(frameId)
  }, [playing])

  const selectAngle = (nextAngle: number) => {
    setPlaying(false)
    setAngle(nextAngle)
  }

  return <section id="moon-phase-preview" className="debug-panel moon-phase-preview" aria-labelledby="moon-phase-preview-title">
    <h2 id="moon-phase-preview-title">月相プレビュー</h2>
    <p className="moon-phase-preview__note">照明率と左右の欠け方を確認する模式表示です。ARと同じ画像・影の部品を使っています。</p>
    <p className="moon-phase-preview__note">96pxは拡大、46pxはAR本体、32pxは画面端のマーカーです。</p>
    <div className="moon-phase-preview__controls">
      <label htmlFor="moon-phase-angle">月相角</label>
      <input id="moon-phase-angle" type="range" min="0" max="360" step="0.1" value={angle}
        onChange={event => selectAngle(Number(event.target.value))} />
      <output htmlFor="moon-phase-angle">{phase.cycleAngle.toFixed(1)}° ／ 照明率 {(phase.illuminatedFraction * 100).toFixed(4)}%</output>
      <button type="button" className="find-moon-button" aria-pressed={playing} onClick={() => setPlaying(current => !current)}>
        {playing ? '停止' : '連続再生'}
      </button>
    </div>
    <div className="moon-phase-preview__selected" role="group" aria-label="選択した月相">
      <MoonSizes phase={phase} />
    </div>
    <div className="moon-phase-preview__boundaries" role="group" aria-label="境界付近の確認">
      <p>境界付近を確認</p>
      {MOON_PHASE_BOUNDARIES.map(boundary => <button key={boundary} type="button" onClick={() => selectAngle(boundary)}>
        {boundary}°
      </button>)}
    </div>
    <ul className="moon-phase-preview__gallery">
      {MOON_PHASE_PRESETS.map(preset => {
        const sample = getPreviewMoonPhase(preset.angle)
        return <li key={preset.angle}>
          <figure aria-label={preset.label}>
            <figcaption><button type="button" aria-pressed={phase.cycleAngle === preset.angle}
              onClick={() => selectAngle(preset.angle)}>{preset.label}</button></figcaption>
            <MoonSizes phase={sample} />
            <p>{preset.angle}° ／ 照明率 {(sample.illuminatedFraction * 100).toFixed(2)}%</p>
          </figure>
        </li>
      })}
    </ul>
  </section>
}
