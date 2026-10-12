export const normalizeAzimuth = (angle: number): number => ((angle % 360) + 360) % 360

/** Shortest signed difference, in [-180, 180). */
export function getAzimuthDifference(azimuth: number, viewAzimuth: number): number {
  return ((azimuth - viewAzimuth + 180) % 360 + 360) % 360 - 180
}
