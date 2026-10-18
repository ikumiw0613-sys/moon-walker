import { getAzimuthDifference } from '../../shared/math/angles'
import { projectDirectionToScreen } from '../../shared/math/coordinates'
import type { Vector3 } from '../../shared/math/types'
import { getMoonProjectionDiagnostics } from '../moon-guide/moonProjection'

export type Size = { width: number; height: number }
export type Rect = Size & { left: number; top: number }
export type ProjectionPoint = { x: number; y: number; visible: boolean }
export type Fov = { horizontal: number; vertical: number }
export type FovMode = 'production' | 'square' | 'window-h' | 'viewport-h' | 'viewport-v'
export type Placement = 'viewport' | 'full-screen'
export const FOV_MISMATCH_WARNING_PERCENT = 10
const radians = (degrees: number) => degrees * Math.PI / 180
const degrees = (radians: number) => radians * 180 / Math.PI
const validSize = (size: Size | null): size is Size => !!size && [size.width, size.height].every(value => Number.isFinite(value) && value > 0)

/** Requested rect-based mapping. CSS borders/transforms can be detected by comparing the actual DOM center. */
export function viewportToWindow(point: ProjectionPoint | null, viewport: Rect | null, windowSize: Size | null) {
  if (!point || !viewport || !validSize(windowSize)
    || ![point.x, point.y, viewport.left, viewport.top, viewport.width, viewport.height].every(Number.isFinite)
    || viewport.width < 0 || viewport.height < 0) return null
  const windowX = viewport.left + point.x * viewport.width
  const windowY = viewport.top + point.y * viewport.height
  return { windowX, windowY, normalizedWindowX: windowX / windowSize.width, normalizedWindowY: windowY / windowSize.height }
}

export function aspectFromFov(fov: Fov): number | null {
  if (![fov.horizontal, fov.vertical].every(value => Number.isFinite(value) && value > 0 && value < 180)) return null
  return Math.tan(radians(fov.horizontal) / 2) / Math.tan(radians(fov.vertical) / 2)
}
export function verticalFov(horizontal: number, aspect: number): number {
  return degrees(2 * Math.atan(Math.tan(radians(horizontal) / 2) / aspect))
}
export function horizontalFov(vertical: number, aspect: number): number {
  return degrees(2 * Math.atan(aspect * Math.tan(radians(vertical) / 2)))
}
export function fovConsistency(size: Size | null, fov: Fov) {
  const expectedAspect = aspectFromFov(fov)
  if (!validSize(size) || expectedAspect === null) return null
  const aspect = size.width / size.height
  const mismatchPercent = (aspect / expectedAspect - 1) * 100
  return { aspect, expectedAspect, mismatchPercent, warning: Math.abs(mismatchPercent) > FOV_MISMATCH_WARNING_PERCENT }
}

/** Diagnostic FOVs only; read production constants through its existing readout. */
export function selectDiagnosticFov(mode: FovMode, windowSize: Size | null, viewport: Size | null): Fov | null {
  const production = getMoonProjectionDiagnostics(null)
  const base = { horizontal: production.horizontalFov, vertical: production.verticalFov }
  if (mode === 'production') return base
  if (mode === 'square') return { horizontal: 90, vertical: 90 }
  const size = mode === 'window-h' ? windowSize : viewport
  if (!validSize(size)) return null
  const aspect = size.width / size.height
  return mode === 'viewport-v' ? { horizontal: horizontalFov(base.vertical, aspect), vertical: base.vertical }
    : { horizontal: base.horizontal, vertical: verticalFov(base.horizontal, aspect) }
}

/** Separate sandbox calculation: never used by projectMoonToScreen or production guidance. */
export function projectWithDiagnosticFov(moon: Vector3 | null, fov: Fov | null) {
  if (!moon || !fov || aspectFromFov(fov) === null || ![moon.x, moon.y, moon.z].every(Number.isFinite) || -moon.z <= 0) return null
  const normalizedX = moon.x / (-moon.z * Math.tan(radians(fov.horizontal) / 2))
  const normalizedY = moon.y / (-moon.z * Math.tan(radians(fov.vertical) / 2))
  return { normalizedX, normalizedY, x: (normalizedX + 1) / 2, y: (1 - normalizedY) / 2,
    visible: Math.abs(normalizedX) <= 1 && Math.abs(normalizedY) <= 1 }
}

/** Two existing projection paths observing the SAME render's pose and moon. No manual viewpoint. */
export function compareProjections(moon: { azimuth: number; altitude: number } | null,
  view: { azimuth: number; altitude: number } | null, moonInDevice: Vector3 | null) {
  const production = getMoonProjectionDiagnostics(moonInDevice)
  const valid = moon && view && [moon.azimuth, moon.altitude, view.azimuth, view.altitude].every(Number.isFinite)
  const twoD = valid ? projectDirectionToScreen(moon.azimuth, moon.altitude, view.azimuth, view.altitude) : null
  return { twoD, production,
    azimuthDifference: valid ? getAzimuthDifference(moon.azimuth, view.azimuth) : null,
    altitudeDifference: valid ? moon.altitude - view.altitude : null,
    // 2D outputs percent; compare only after converting BOTH paths to 0..1 units.
    deltaX: twoD && production.normalizedX !== null ? production.screen!.x - twoD.x / 100 : null,
    deltaY: twoD && production.normalizedY !== null ? production.screen!.y - twoD.y / 100 : null }
}

export function readARProjectionFlags(search: string) {
  const query = new URLSearchParams(search)
  const enabled = query.get('arDebug') === 'projection'
  return { enabled, placement: enabled && query.get('arProjection') === 'full-screen' ? 'full-screen' as const : 'viewport' as const }
}
