import type { DeviceOrientation } from '../lib/deviceView'
import { getDeviceView, normalizeAzimuth } from '../lib/deviceView'
import { deviceOrientationToMatrix, moonDirectionToVector, multiplyMatrixVector } from '../lib/vector3'

// 診断専用。既存処理の出力を観察し、アプリの計算経路には使用しない。
export function getOrientationDiagnostics(orientation: DeviceOrientation, northOffset: number | null) {
  const { alpha, beta, gamma } = orientation
  const valid = alpha !== null && beta !== null && gamma !== null && [alpha, beta, gamma].every(Number.isFinite)
  const before = valid
    ? multiplyMatrixVector(deviceOrientationToMatrix(alpha, beta, gamma), { x: 0, y: 0, z: -1 }) : null
  const beforeDirection = before && Math.hypot(before.x, before.y) >= 1e-6
    ? { azimuth: normalizeAzimuth(Math.atan2(before.x, before.y) * 180 / Math.PI), altitude: Math.asin(Math.max(-1, Math.min(1, before.z))) * 180 / Math.PI }
    : null
  const view = getDeviceView(orientation)
  const hasCompass = orientation.absolute || orientation.compassHeading !== null
  const afterDirection = view && (hasCompass || northOffset !== null)
    ? { ...view, azimuth: normalizeAzimuth(view.azimuth + (hasCompass ? 0 : northOffset ?? 0)) } : null
  const after = afterDirection ? moonDirectionToVector(afterDirection.azimuth, afterDirection.altitude) : null
  const radians = Math.PI / 180
  const cosBeta = valid ? Math.cos(beta * radians) : null
  const topHeading = valid
    ? Math.atan2(-Math.sin(alpha * radians) * Math.cos(beta * radians), Math.cos(alpha * radians) * Math.cos(beta * radians)) / radians : null
  // getDeviceViewの現在の式をそのまま表示する。90°付近の分岐も修正しない。
  const correctionAngle = !afterDirection || !valid ? null
    : orientation.compassHeading !== null
      ? Math.abs(cosBeta!) > 1e-6 ? orientation.compassHeading - topHeading! : orientation.compassHeading + alpha
      : orientation.absolute ? 0 : northOffset
  const correctionSource = !afterDirection ? 'なし'
    : orientation.compassHeading !== null ? 'webkitCompassHeading'
      : orientation.absolute ? 'absolute' : '手動補正'
  return {
    before, beforeDirection, after, afterDirection, correctionAngle, correctionSource, topHeading,
    topHorizontalLength: cosBeta === null ? null : Math.abs(cosBeta),
    usesFallback: cosBeta === null ? null : Math.abs(cosBeta) <= 1e-6,
  }
}
