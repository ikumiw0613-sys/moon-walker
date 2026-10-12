import { MoonImage } from './MoonImage'
import './MoonSprite.css'

type MoonSpriteProps = {
  x: number
  y: number
  visible: boolean
}

export function MoonSprite({
  x,
  y,
  visible,
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
      <MoonImage />
    </div>
  )
}
