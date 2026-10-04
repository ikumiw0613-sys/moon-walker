import type { MoonPosition } from '../types/moon'
import { getAzimuthDifference } from './coordinates'
import type { ViewDirection } from './coordinates'

export const CENTER_AZIMUTH_THRESHOLD = 5
export const CENTER_ALTITUDE_THRESHOLD = 5

export type MoonNavigation = {
  status: 'below-horizon' | 'centered' | 'guiding'
  message: string
}

export function getMoonNavigation(moon: MoonPosition, view: ViewDirection): MoonNavigation {
  if (!moon.isAboveHorizon) {
    return { status: 'below-horizon', message: '現在、月は地平線の下にあります' }
  }

  const azimuthDiff = getAzimuthDifference(moon.azimuth, view.azimuth)
  const altitudeDiff = moon.altitude - view.altitude
  const horizontal = Math.abs(azimuthDiff) <= CENTER_AZIMUTH_THRESHOLD
    ? ''
    : azimuthDiff > 0 ? '右' : '左'
  const vertical = Math.abs(altitudeDiff) <= CENTER_ALTITUDE_THRESHOLD
    ? ''
    : altitudeDiff > 0 ? '上' : '下'

  if (!horizontal && !vertical) {
    return { status: 'centered', message: '月はここ！' }
  }

  return { status: 'guiding', message: `${horizontal}${vertical}へ` }
}
