import { Body, Equator, Horizon, Observer } from 'astronomy-engine'

export type SunPosition = {
  azimuth: number
  altitude: number
  isAboveHorizon: boolean
}

// 一時的な太陽検証用。月と同じ観測者・日付座標・大気差補正を使用する。
export function getSunPosition(latitude: number, longitude: number, date: Date): SunPosition {
  const observer = new Observer(latitude, longitude, 0)
  const equator = Equator(Body.Sun, date, observer, true, true)
  const sun = Horizon(date, observer, equator.ra, equator.dec, 'normal')
  return { azimuth: sun.azimuth, altitude: sun.altitude, isAboveHorizon: sun.altitude > 0 }
}
