import { getAzimuthDifference } from './angles'

export type ScreenPosition = {
  x: number
  y: number
  isVisible: boolean
}

export type ViewDirection = {
  azimuth: number
  altitude: number
}

export function projectDirectionToScreen(
  azimuth: number,
  altitude: number,
  viewAzimuth: number,
  viewAltitude: number
): ScreenPosition {
  const horizontalDiff = getAzimuthDifference(azimuth, viewAzimuth)
  const verticalDiff = altitude - viewAltitude
  const x = 50 + (horizontalDiff / 45) * 50
  const y = 50 - (verticalDiff / 30) * 50
  const isVisible =
    horizontalDiff >= -45 &&
    horizontalDiff <= 45 &&
    verticalDiff >= -30 &&
    verticalDiff <= 30

  return {
    x,
    y,
    isVisible,
  }

}
