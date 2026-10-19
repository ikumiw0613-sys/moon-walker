import type { Matrix3, Vector3 } from '../../shared/math/types'
import type { LocationState } from '../geolocation/types'
import type { MoonPosition } from '../moon/types'
import type { getMoonDeviceState } from '../moon-guide/moonDeviceNavigation'
import { getMoonProjectionDiagnostics } from '../moon-guide/moonProjection'
import { getCameraForward, cameraVectorToViewAngles } from '../sky/skyParallax'
import type { PoseStability } from '../device-orientation/poseStability'
import { getDirectionErrorDiagnostics } from './directionErrorDiagnostics'

export type MoonPipelineContext = {
  observationDate: Date | null
  location: LocationState
  timeMode: 'fixed' | 'current'
  orientationSource: 'sensor' | 'manual'
  orientationStatus: string
  northCorrection: number | null
  poseStability?: PoseStability
}

export type MoonPipelineInput = {
  transform: ReturnType<typeof getMoonDeviceState>
  moonPosition: MoonPosition | null
  context: MoonPipelineContext
}

function vectorIssue(vector: Vector3 | null, name: string): string | null {
  if (!vector) return `${name} unavailable`
  if (![vector.x, vector.y, vector.z].every(Number.isFinite)) return `${name} unavailable (non-finite vector)`
  const length = Math.hypot(vector.x, vector.y, vector.z)
  return !Number.isFinite(length) || length === 0 ? `${name} unavailable (invalid vector length)` : null
}

function validMatrix(matrix: Matrix3 | null): matrix is Matrix3 {
  return Array.isArray(matrix) && matrix.length === 3 && matrix.every(row => Array.isArray(row)
    && row.length === 3 && row.every(Number.isFinite))
}

/** Observe production outputs; never recalculate astronomy, north correction, or moonInDevice. */
export function getMoonPipelineDiagnostics({ transform, moonPosition, context }: MoonPipelineInput) {
  const location = context.location.status === 'success' ? context.location.location : null
  const locationReason = !location ? 'location unavailable'
    : ![location.latitude, location.longitude].every(Number.isFinite) ? 'location unavailable (non-finite coordinates)' : null
  const observationTime = context.observationDate && Number.isFinite(context.observationDate.getTime())
    ? context.observationDate.toISOString() : null
  const moonReason = !moonPosition ? 'moon position unavailable'
    : ![moonPosition.azimuth, moonPosition.altitude].every(Number.isFinite) ? 'moon position unavailable (non-finite angles)' : null
  const rotationReason = validMatrix(transform.correctedRotation) ? null : 'correctedRotation unavailable'
  // Same helpers as useARView, guarded so their invalid-input fallback never invents zero angles.
  const forwardCandidate = !rotationReason ? getCameraForward(transform.correctedRotation!) : null
  const forwardReason = vectorIssue(forwardCandidate, 'corrected cameraForward')
  const cameraForward = forwardReason ? null : forwardCandidate
  const viewAngles = cameraForward ? cameraVectorToViewAngles(cameraForward) : null
  const correctedHeading = viewAngles && Number.isFinite(viewAngles.heading) && transform.correctedHeading !== null
    ? viewAngles.heading : null
  const correctedAltitude = viewAngles && Number.isFinite(viewAngles.altitude) ? viewAngles.altitude : null
  const headingReason = correctedHeading === null
    ? rotationReason ?? forwardReason ?? 'heading unavailable (camera vertical)' : null
  const worldReason = vectorIssue(transform.moonWorld, 'moonWorld')
  const deviceReason = vectorIssue(transform.moonInDevice, 'moonInDevice')
  const worldLength = !worldReason ? Math.hypot(transform.moonWorld!.x, transform.moonWorld!.y, transform.moonWorld!.z) : null
  const deviceLength = !deviceReason ? Math.hypot(transform.moonInDevice!.x, transform.moonInDevice!.y, transform.moonInDevice!.z) : null
  const projection = getMoonProjectionDiagnostics(transform.moonInDevice)
  const navigation = transform.navigation && Number.isFinite(transform.navigation.angleToMoon) ? transform.navigation : null
  let renderingReason: string | null = null
  if (context.orientationSource === 'manual') renderingReason = 'Debug manual orientation (AR uses the device sensor)'
  else if (context.orientationStatus !== 'active') renderingReason = 'orientation inactive (AR withholds correctedRotation)'
  else if (rotationReason) renderingReason = rotationReason
  else if (context.poseStability && context.poseStability.status !== 'stable') renderingReason = `pose ${context.poseStability.status} (AR suppresses guidance)`
  else if (!moonPosition) renderingReason = 'moon position unavailable'
  else if (!moonPosition.isAboveHorizon) renderingReason = 'moon below horizon (AR suppresses guidance and MoonSprite)'
  else if (!navigation) renderingReason = 'navigation unavailable'
  else if (projection.reason) renderingReason = projection.reason
  else if (!projection.screen?.visible) renderingReason = 'outside view frustum (MoonSprite visible=false)'
  return {
    context, observationTime, location, moonPosition,
    cameraForward, correctedHeading, correctedAltitude, headingReason,
    directionError: getDirectionErrorDiagnostics(moonPosition, correctedHeading, correctedAltitude),
    // Preserve shared output references: no debug-only inverse transformation.
    moonWorld: transform.moonWorld, moonInDevice: transform.moonInDevice, worldLength, deviceLength,
    correctedRotation: transform.correctedRotation, projection, navigation,
    reasons: {
      astronomy: locationReason ?? (observationTime ? null : 'observationTime unavailable') ?? moonReason,
      deviceView: rotationReason ?? forwardReason,
      moonWorld: moonReason ?? worldReason,
      moonInDevice: worldReason ?? rotationReason ?? deviceReason,
      projection: projection.reason,
      navigation: navigation ? null : 'navigation unavailable',
      MoonSprite: renderingReason,
    },
  }
}

export type MoonPipelineDiagnostics = ReturnType<typeof getMoonPipelineDiagnostics>

function snapshotValue(value: number | boolean | string | null | undefined): string {
  if (value === null || value === undefined) return 'unavailable'
  return typeof value === 'number' && !Number.isFinite(value) ? 'unavailable (non-finite)' : String(value)
}

function vectorText(vector: Vector3 | null): string {
  return vector ? `(${snapshotValue(vector.x)}, ${snapshotValue(vector.y)}, ${snapshotValue(vector.z)})` : 'unavailable'
}

/** A single render's snapshot and visible fallback; no extra sensor or time reads. */
export function formatMoonPipelineDiagnostics(data: MoonPipelineDiagnostics): string {
  const { context, projection, navigation } = data
  const lines: [string, number | boolean | string | null | undefined][] = [
    ['time', data.observationTime], ['timeMode', context.timeMode],
    ['latitude', data.location?.latitude], ['longitude', data.location?.longitude],
    ['orientation.source', context.orientationSource], ['orientation.status', context.orientationStatus],
    ['northCorrection (saved, degrees)', context.northCorrection],
    ['moon.azimuth', data.moonPosition?.azimuth], ['moon.altitude', data.moonPosition?.altitude],
    ['moon.isAboveHorizon', data.moonPosition?.isAboveHorizon],
    ['correctedHeading', data.correctedHeading], ['correctedHeading.reason', data.headingReason ?? 'available'],
    ['correctedAltitude', data.correctedAltitude], ['cameraForward', vectorText(data.cameraForward)],
    ['headingError', data.directionError.headingError], ['altitudeError', data.directionError.altitudeError],
    ['mainErrorAxis', data.directionError.mainErrorAxis],
    ['moonWorld', vectorText(data.moonWorld)], ['moonWorld.length', data.worldLength],
    ['correctedRotation', data.correctedRotation ? data.correctedRotation.map(row => `(${row.map(value => snapshotValue(value)).join(', ')})`).join(' / ') : null],
    ['transform', 'moonInDevice = transpose(correctedRotation) * moonWorld'],
    ['moonInDevice', vectorText(data.moonInDevice)], ['moonInDevice.length', data.deviceLength],
    ['projection.depth', projection.depth], ['projection.normalizedX', projection.normalizedX],
    ['projection.normalizedY', projection.normalizedY], ['projection.horizontalFov (degrees)', projection.horizontalFov],
    ['projection.verticalFov (degrees)', projection.verticalFov],
    ['screenX', projection.screen?.x], ['screenY', projection.screen?.y], ['visible', projection.screen?.visible],
    ['angleToMoon', navigation?.angleToMoon], ['navigation.status', navigation?.status],
    ['navigation.arrow', navigation?.arrow], ['navigation.message', navigation?.message],
    ['MoonSprite.x', projection.screen?.x], ['MoonSprite.y', projection.screen?.y], ['MoonSprite.visible', projection.screen?.visible],
    ['MoonSprite.left (%)', projection.screen ? projection.screen.x * 100 : null],
    ['MoonSprite.top (%)', projection.screen ? projection.screen.y * 100 : null],
    ['MoonSprite.mapping', 'left = screenX * 100%; top = screenY * 100%; translate(-50%, -50%)'],
    ['MoonSprite.gates', 'AR requires active stable orientation, navigation and projection; below-horizon guidance is hidden; visible=false renders nothing; positions are relative to .mw-ar-viewport'],
  ]
  if (context.poseStability) {
    const pose = context.poseStability
    lines.push(['pose.stability', pose.status], ['pose.reason', pose.reason], ['pose.headingDelta', pose.headingDelta],
      ['pose.altitudeDelta', pose.altitudeDelta], ['pose.rotationDelta', pose.rotationDelta],
      ['pose.intervalMs', pose.intervalMs], ['pose.gravityDifference', pose.gravityDifference], ['pose.gravityReason', pose.gravityReason ?? 'available'])
  }
  for (const [stage, reason] of Object.entries(data.reasons)) lines.push([`pipeline.${stage}.status`, reason ?? 'available'])
  return ['Moon transform pipeline', ...lines.map(([key, value]) => `${key}: ${snapshotValue(value)}`)].join('\n')
}
