import { getAzimuthDifference } from './coordinates'
import { normalizeAzimuth } from './deviceView'

const DEG_TO_RAD = Math.PI / 180
const EARTH_RADIUS_METERS = 6371000

function validCoordinates(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
}

/** 球面上の初期方位角。真北0°、東90°。同一点・対蹠点等は方位未確定のnull。 */
export function calculateBearing(fromLatitude: number, fromLongitude: number, toLatitude: number, toLongitude: number): number | null {
  if (!validCoordinates(fromLatitude, fromLongitude) || !validCoordinates(toLatitude, toLongitude)) return null
  const from = fromLatitude * DEG_TO_RAD
  const to = toLatitude * DEG_TO_RAD
  const delta = (toLongitude - fromLongitude) * DEG_TO_RAD
  const east = Math.sin(delta) * Math.cos(to)
  const north = Math.cos(from) * Math.sin(to) - Math.sin(from) * Math.cos(to) * Math.cos(delta)
  if (Math.hypot(east, north) < 1e-12) return null
  return normalizeAzimuth(Math.atan2(east, north) / DEG_TO_RAD)
}

/** Haversineによる地表距離（m）。高さは含めない。 */
export function calculateDistance(fromLatitude: number, fromLongitude: number, toLatitude: number, toLongitude: number): number | null {
  if (!validCoordinates(fromLatitude, fromLongitude) || !validCoordinates(toLatitude, toLongitude)) return null
  const latitudeDelta = (toLatitude - fromLatitude) * DEG_TO_RAD
  const longitudeDelta = (toLongitude - fromLongitude) * DEG_TO_RAD
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(fromLatitude * DEG_TO_RAD) * Math.cos(toLatitude * DEG_TO_RAD) * Math.sin(longitudeDelta / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.max(0, Math.min(1, a))))
}

/** 既存の方位差と同じ[-180, 180)の符号規約。 */
export function normalizeSignedAngle(angle: number): number {
  return getAzimuthDifference(angle, 0)
}

export function compareHeadingToBearing(correctedHeading: number | null, bearing: number | null) {
  if (correctedHeading === null || bearing === null || !Number.isFinite(correctedHeading) || !Number.isFinite(bearing)) return null
  const headingError = normalizeSignedAngle(correctedHeading - bearing)
  const magnitude = Math.abs(headingError)
  return {
    headingError,
    assessment: magnitude <= 5 ? 'かなり近い' : magnitude <= 10 ? '概ね一致' : 'ズレあり',
    guidance: headingError > 0 ? '少し左へ' : headingError < 0 ? '少し右へ' : '方位が一致しています',
  }
}
