import { useId } from 'react'
import type { ReactNode } from 'react'
import { MOON_DISC_GEOMETRY, MOON_IMAGE_PLACEMENT } from '../moonDiscGeometry'
import type { MoonPhaseShape } from '../types'
import { MoonShadow } from './MoonShadow'
import './MoonDisc.css'

type MoonDiscProps = {
  /** 指定した月相に合わせて、画像の上に影を重ねる。 */
  phase?: MoonPhaseShape
  /** 画像と影の上に追加するSVG要素。同じ座標・切り抜き領域で描画する。 */
  children?: ReactNode
}

export function MoonDisc({ phase, children }: MoonDiscProps) {
  // 月本体とマーカーを同時に描画しても、切り抜き領域のIDが重複しないようにする。
  const clipId = useId()
  const { size, centerX, centerY, radius } = MOON_DISC_GEOMETRY

  return (
    <svg className="moon-disc" viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clipId}>
          <circle cx={centerX} cy={centerY} r={radius} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <image href={`${import.meta.env.BASE_URL}moon-image.png`} {...MOON_IMAGE_PLACEMENT} />
        {phase && <MoonShadow phase={phase} />}
        {children}
      </g>
    </svg>
  )
}
