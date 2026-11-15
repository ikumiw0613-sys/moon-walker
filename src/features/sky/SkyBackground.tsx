import type { ReactNode } from 'react'
import { StarCanvas } from './StarCanvas'
import './SkyBackground.css'


type SkyBackgroundProps = {
  children?: ReactNode
  offsetX?: number
  offsetY?: number
  cloudCover?: number | null
  weatherCode?: number | null
}

export function SkyBackground({
  children,
  offsetX = 0,
  offsetY = 0,
  cloudCover = null,
  weatherCode = null,
}: SkyBackgroundProps) {
  const cloudCount = cloudCover === null ? 2 : 1 + Math.round(cloudCover / 20)
  const isRaining = weatherCode !== null
    && ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)
      || (weatherCode >= 95 && weatherCode <= 99))
  const cloudOpacity = cloudCover === null ? 1 : 0.4 + (cloudCover / 100) * 0.6
  return (
    <div className={`sky-background${isRaining ? ' sky-background--rain' : ''}`}>
      <div className="sky-background__glow" />
      <StarCanvas offsetX={offsetX} offsetY={offsetY} />

      {Array.from({ length: cloudCount }, (_, index) => (
        <div
          key={index}
          className={`sky-cloud sky-cloud--slot-${index % 6}`}
          style={{
            transform: `translate(${offsetX * (0.25 + (index % 3) * 0.15)}px,${offsetY * (0.15 + (index % 2) * 0.2)}px) scale(${[1, 1, 0.8, 0.9, 0.7, 0.75][index % 6]})`,
            opacity: cloudOpacity,
          }}
        />
      ))}
      {isRaining && <div className="sky-background__rain" aria-hidden="true" />}
      <div className="sky-background__haze" />
      <div className="sky-background__content">
        {children}
      </div>
    </div>
  )
}
