import type { Vector3 } from '../../shared/math/types'

type ScreenPoint = {
  x: number
  y: number
  visible: boolean
}

const HORIZONTAL_FOV = 90
const VERTICAL_FOV = 60

/** Place an offscreen direction marker along the edge of the sky viewport. */
export function getMoonEdgePosition(point: ScreenPoint) {
  const dx = point.x - 0.5
  const dy = point.y - 0.5
  const scale = Math.max(Math.abs(dx), Math.abs(dy))
  if (!Number.isFinite(scale) || scale === 0) return { x: 0.5, y: 0.8 }
  return { x: 0.5 + dx / scale * 0.4, y: 0.5 + dy / scale * 0.4 }
}

export function projectMoonToScreen(
  moon: Vector3
): ScreenPoint {
  const depth = -moon.z

  if (depth <= 0) {
    return {
      x: 0.5,
      y: 0.5,
      visible: false,
    }
  }
  const horizontalFov = HORIZONTAL_FOV * Math.PI / 180

  const verticalFov = VERTICAL_FOV * Math.PI / 180

  const normalizedX = moon.x / (depth * Math.tan(horizontalFov / 2))
  const normalizedY =
    moon.y /
    (depth * Math.tan(verticalFov / 2))

  return {
    x: (normalizedX + 1) / 2,
    y: (1 - normalizedY) / 2,
    visible:
      Math.abs(normalizedX) <= 1 &&
      Math.abs(normalizedY) <= 1,
  }

}

/** Debug-only readout of the existing projection; FOV values are in degrees. */
export function getMoonProjectionDiagnostics(moon: Vector3 | null): {
  screen: ReturnType<typeof projectMoonToScreen> | null
  depth: number | null
  normalizedX: number | null
  normalizedY: number | null
  horizontalFov: number
  verticalFov: number
  reason: string | null
} {
  const unavailable = {
    screen: null,
    depth: null,
    normalizedX: null,
    normalizedY: null,
    horizontalFov: HORIZONTAL_FOV,
    verticalFov: VERTICAL_FOV,
  }

  if (moon == null) {
    return { ...unavailable, reason: 'moonInDevice unavailable' }
  }
  if (![moon.x, moon.y, moon.z].every(Number.isFinite)) {
    return { ...unavailable, reason: 'projection unavailable (non-finite input)' }
  }

  const depth = -moon.z
  const screen = projectMoonToScreen(moon)
  if (!Number.isFinite(depth) || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) {
    return { ...unavailable, reason: 'projection unavailable (non-finite output)' }
  }
  if (depth <= 0) {
    // Production returns before calculating normalized coordinates in this case.
    return {
      ...unavailable,
      screen,
      depth,
      reason: depth < 0 ? 'behind camera' : 'on camera plane',
    }
  }

  // Invert the production screen mapping, rather than duplicating its FOV math.
  const normalizedX = 2 * screen.x - 1
  const normalizedY = 1 - 2 * screen.y
  if (!Number.isFinite(normalizedX) || !Number.isFinite(normalizedY)) {
    return { ...unavailable, reason: 'projection unavailable (non-finite output)' }
  }
  return {
    screen,
    depth,
    normalizedX,
    normalizedY,
    horizontalFov: HORIZONTAL_FOV,
    verticalFov: VERTICAL_FOV,
    reason: null,
  }
}
