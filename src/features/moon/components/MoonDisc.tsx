import { useId } from 'react'
import type { ReactNode } from 'react'
import { MOON_DISC_GEOMETRY, MOON_IMAGE_PLACEMENT } from '../moonDiscGeometry'
import './MoonDisc.css'

type MoonDiscProps = {
  /** 後続で追加する影などのSVG要素。画像と同じ座標・切り抜き領域で描画する。 */
  children?: ReactNode
}

export function MoonDisc({ children }: MoonDiscProps) {
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
        {children}
      </g>
    </svg>
  )
}
