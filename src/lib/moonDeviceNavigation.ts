import type { Vector3, Matrix3 } from '../types/vector3'
import type { MoonPosition } from '../types/moon'
import { applyNorthCorrection, moonDirectionToVector, multiplyMatrixVector, transposeMatrix3 } from './vector3'

export const MOON_CENTER_THRESHOLD_DEGREES = 5

export function getMoonInDevice(moon: MoonPosition, deviceRotation: Matrix3, northCorrection: number): Vector3 {
  const moonWorld = moonDirectionToVector(moon.azimuth, moon.altitude)
  const correctedRotation = applyNorthCorrection(deviceRotation, northCorrection)
  return multiplyMatrixVector(transposeMatrix3(correctedRotation), moonWorld)
}

export function getMoonDeviceNavigation(moon: Vector3) {
  const length = Math.hypot(moon.x, moon.y, moon.z)
  if (!Number.isFinite(length) || length === 0) return null
  const angleToMoon = Math.acos(Math.max(-1, Math.min(1, -moon.z / length))) * 180 / Math.PI
  if (moon.z >= 0) return { status: 'behind', message: '反対方向を向いてください', arrow: '↶', angleToMoon } as const
  if (angleToMoon <= MOON_CENTER_THRESHOLD_DEGREES) return { status: 'centered', message: '月はここ！', arrow: '◎', angleToMoon } as const
  const horizontal = Math.abs(moon.x) >= Math.abs(moon.y)
  const message = horizontal ? (moon.x > 0 ? '右へ' : '左へ') : (moon.y > 0 ? '上へ' : '下へ')
  const arrow = horizontal ? (moon.x > 0 ? '→' : '←') : (moon.y > 0 ? '↑' : '↓')
  return { status: 'guiding', message, arrow, angleToMoon } as const
}
