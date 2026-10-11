import type { ReactNode } from 'react'
import { StarCanvas } from './StarCanvas'
import './SkyBackground.css'


type SkyBackgroundProps = {
  children ?: ReactNode
  offsetX ?: number
  offsetY ?: number
}

export function SkyBackground({
  children,
  offsetX = 0,
  offsetY = 0,
}: SkyBackgroundProps) {
  return (
    <div className= "sky-background">
      <div className="sky-background_glow" />
      <StarCanvas offsetX={offsetX} offsetY={offsetY}/>
      <div className="sky-background_content">
        {children}
      </div>
    </div>
  )
}