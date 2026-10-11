import type { ReactNode } from 'react'
import './SkyBackground.css'

type SkyBackgroundProps = {
  children ?: ReactNode
}

export function SkyBackground({
  children,
}: SkyBackgroundProps) {
  return (
    <div className= "sky-background">
      <div className="sky-background_glow" />
      <div className="sky-background_content">
        {children}
      </div>
    </div>
  )
}