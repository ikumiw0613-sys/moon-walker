import type { ViewDirection } from './coordinates'

export type DeviceOrientation = {
  alpha: number | null
  beta: number | null
  gamma: number | null
  absolute: boolean
  compassHeading: number | null
}

export const normalizeAzimuth = (angle: number): number => ((angle % 360) + 360) % 360

// 画面の裏側へ向かうベクトルを地球座標へ変換する（Z-X-Yの回転）。
// 画面を自分へ向けて持つと、その裏側が探している空の方向になる。
export function getDeviceView(orientation: DeviceOrientation): ViewDirection | null {
  const { alpha, beta, gamma } = orientation
  if (alpha === null || beta === null || gamma === null || ![alpha, beta, gamma].every(Number.isFinite)) return null
  const radians = Math.PI / 180
  const a = alpha * radians
  const b = beta * radians
  const g = gamma * radians
  const east = -Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(b) * Math.cos(g)
  const north = -Math.sin(a) * Math.sin(g) + Math.cos(a) * Math.sin(b) * Math.cos(g)
  const up = -Math.cos(b) * Math.cos(g)
  // 真上・真下では方位角を一意に決められない。
  if (Math.hypot(east, north) < 1e-6) return null
  let azimuth = Math.atan2(east, north) / radians
  if (orientation.compassHeading !== null) {
    const topHeading = Math.atan2(-Math.sin(a) * Math.cos(b), Math.cos(a) * Math.cos(b)) / radians
    if (Math.abs(Math.cos(b)) > 1e-6) {
      azimuth += orientation.compassHeading - topHeading
    } else {
      azimuth += orientation.compassHeading + alpha
    }
  }
  return { azimuth: normalizeAzimuth(azimuth), altitude: Math.asin(Math.max(-1, Math.min(1, up))) / radians }
}
