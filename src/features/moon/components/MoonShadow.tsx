import { getMoonShadowPath } from '../moonShadow'
import type { MoonPhaseShape } from '../types'
import './MoonShadow.css'

type MoonShadowProps = {
  phase: MoonPhaseShape
}

export function MoonShadow({ phase }: MoonShadowProps) {
  const path = getMoonShadowPath(phase)
  if (path === null) return null

  return <path className="moon-shadow" d={path} />
}
