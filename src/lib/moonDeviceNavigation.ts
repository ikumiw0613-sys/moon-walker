import type { Vector3, Matrix3 } from '../types/vector3'
import type { MoonPosition } from '../types/moon'
import { deviceOrientationToMatrix, moonDirectionToVector } from './vector3'
import { getCelestialDirectionInDevice, getNorthReferencedDeviceRotation } from './northReferencedDevice'

export const MOON_CENTER_THRESHOLD_DEGREES = 5

export function getMoonInDevice(moon: MoonPosition, deviceRotation: Matrix3, northCorrection: number): Vector3 {
  const moonWorld = moonDirectionToVector(moon.azimuth, moon.altitude)
  const { correctedRotation } = getNorthReferencedDeviceRotation(deviceRotation, northCorrection)
  if (!correctedRotation) throw new RangeError('北補正と端末姿勢は有限値である必要があります。')
  return getCelestialDirectionInDevice(moonWorld, correctedRotation)
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

/** Shared output for DebugPage diagnostics and ARPage guidance, independent of UI mode. */
export function getMoonDeviceState(
  orientation: { alpha: number | null; beta: number | null; gamma: number | null },
  northCorrection: number | null,
  moon: MoonPosition | null,
  compassHeading: number | null = null,
) {
  const { alpha, beta, gamma } = orientation
  const deviceRotation = alpha !== null && beta !== null && gamma !== null
    && [alpha, beta, gamma].every(Number.isFinite) ? deviceOrientationToMatrix(alpha, beta, gamma) : null
  const camera = getNorthReferencedDeviceRotation(deviceRotation, northCorrection, compassHeading)
  const moonWorld = moon && [moon.azimuth, moon.altitude].every(Number.isFinite)
    ? moonDirectionToVector(moon.azimuth, moon.altitude) : null
  const moonInDevice = moonWorld && camera.correctedRotation
    ? getCelestialDirectionInDevice(moonWorld, camera.correctedRotation) : null
  const navigation = moonInDevice ? getMoonDeviceNavigation(moonInDevice) : null
  return { ...camera, deviceRotation, moonWorld, moonInDevice, navigation,
    angleToMoon: navigation?.angleToMoon ?? null,
    moonVectorLength: moonInDevice ? Math.hypot(moonInDevice.x, moonInDevice.y, moonInDevice.z) : null }
}

/** Nonvisual diagnostics for comparing both pages in remote developer tools. */
export function getMoonDeviceDiagnosticAttributes(state: ReturnType<typeof getMoonDeviceState>, date: Date | null) {
  return {
    'data-corrected-heading': state.correctedHeading ?? 'null',
    'data-corrected-rotation': JSON.stringify(state.correctedRotation),
    'data-moon-in-device': JSON.stringify(state.moonInDevice),
    'data-angle-to-moon': state.angleToMoon ?? 'null',
    'data-observation-time': date?.toISOString() ?? 'null',
    'data-device-rotation': JSON.stringify(state.deviceRotation),
  }
}
