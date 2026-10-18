import { MoonDisc } from '../../../features/moon/components/MoonDisc'
import type { MoonPhaseInfo } from '../../../features/moon/types'
import type { Ref } from 'react'
import { createPortal } from 'react-dom'
import './MoonSprite.css'

type MoonSpriteProps = {
  x: number
  y: number
  visible: boolean
  phase: MoonPhaseInfo
  diagnosticWindow?: { width: number; height: number } | null
  diagnosticRef?: Ref<HTMLDivElement>
}

export function MoonSprite({
  x,
  y,
  visible,
  phase,
  diagnosticWindow,
  diagnosticRef,
}: MoonSpriteProps) {
  if (!visible) return null
  const sprite = (
    <div
      ref={diagnosticRef}
      className="moon-sprite"
      style={{
        ...(diagnosticWindow ? { position: 'fixed' as const, zIndex: 850 } : {}),
        left: diagnosticWindow ? `${x * diagnosticWindow.width}px` : `${x * 100}%`,
        top: diagnosticWindow ? `${y * diagnosticWindow.height}px` : `${y * 100}%`,
      }}
      aria-hidden="true"
    >
      <MoonDisc phase={phase} />
    </div>
  )
  // Opt-in experiment only. Body portal avoids transformed application ancestors changing fixed positioning.
  return diagnosticWindow ? createPortal(sprite, document.body) : sprite
}
