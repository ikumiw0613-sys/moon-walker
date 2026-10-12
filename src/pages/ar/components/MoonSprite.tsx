import { MoonDisc } from '../../../features/moon/components/MoonDisc'
import type { MoonPhaseInfo } from '../../../features/moon/types'
import './MoonSprite.css'

type MoonSpriteProps = {
  x: number
  y: number
  visible: boolean
  phase: MoonPhaseInfo
}

export function MoonSprite({
  x,
  y,
  visible,
  phase,
}: MoonSpriteProps) {
  if (!visible) return null
  return (
    <div
      className="moon-sprite"
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
      }}
      aria-hidden="true"
    >
      <MoonDisc phase={phase} />
    </div>
  )
}
