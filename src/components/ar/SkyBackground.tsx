import type { ReactNode } from 'react'
import { StarCanvas } from './StarCanvas'
import './SkyBackground.css'


type SkyBackgroundProps = {
  children?: ReactNode
  offsetX?: number
  offsetY?: number
}

export function SkyBackground({
  children,
  offsetX = 0,
  offsetY = 0,
}: SkyBackgroundProps) {
  return (
    <div className="sky-background">
      <div className="sky-background_glow" />
      <StarCanvas offsetX={offsetX} offsetY={offsetY} />

      <div className="sky-cloud sky-cloud--far"
        style={{
          transform: `translate(${offsetX * 0.25}px,${offsetY * 0.15}px)`,
        }}
      />


      <div
        className="sky-cloud sky-cloud--near"
        style={{
          transform: `translate(${offsetX * 0.6}px, ${offsetY * 0.35}px)`,
        }}
      />
      <div className="sky-background__haze" />
      <div className="sky-background_content">
        {children}
      </div>
    </div>
  )
}