import type { Vector3 } from '../types/vector3'

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
