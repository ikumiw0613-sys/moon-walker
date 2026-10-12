import { getMoonShadowPath } from '../moonShadow'
import type { MoonPhaseInfo } from '../types'
import './MoonShadow.css'

type MoonShadowProps = {
  phase: MoonPhaseInfo
}

export function MoonShadow({ phase }: MoonShadowProps) {
  const path = getMoonShadowPath(phase)
  if (path === null) return null

  return <path className="moon-shadow" d={path} />
}
