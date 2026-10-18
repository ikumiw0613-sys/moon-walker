import { useMemo } from 'react'
import { useDeviceOrientation } from '../../features/device-orientation/useDeviceOrientation'
import { useNorthCalibration } from '../../features/north-calibration/useNorthCalibration'
import { getMoonPosition } from '../../features/moon/astronomy'
import { getMoonPhase } from '../../features/moon/moonPhase'
import { useObservationTime } from '../../shared/time/useObservationTime'
import { getMoonDeviceState } from '../../features/moon-guide/moonDeviceNavigation'

import { useSkyParallax } from '../../features/sky/useSkyParallax'
import {
  getCameraForward,
  cameraVectorToViewAngles,
} from '../../features/sky/skyParallax'

import { getMoonEdgePosition, projectMoonToScreen } from '../../features/moon-guide/moonProjection'

import type { LocationState } from '../../features/geolocation/types'
import { useDeviceMotion } from '../../features/device-motion/useDeviceMotion'
import { usePoseStability } from '../../features/device-orientation/usePoseStability'
import { getARGravityConvention } from '../../features/device-orientation/auxiliaryGravity'
import { getARConfidentGuidance } from '../../features/moon-guide/arGuidanceConfidence'

export function useARView(location: LocationState) {
  const { northCorrection, calibrated, needsRecalibration } = useNorthCalibration()
  const { state: orientation, requestPermission, retryConnection, diagnostics } = useDeviceOrientation({ autoStart: true })
  const gravityConvention = getARGravityConvention()
  const { state: motion, requestPermission: requestMotionPermission } = useDeviceMotion({ autoStart: gravityConvention !== null })
  const { now, mode } = useObservationTime()
  // 位置と月相に同じ観測時刻を渡し、固定日時の使用中も計算の基準をそろえる。
  const moonPhase = useMemo(() => getMoonPhase(now), [now])
  const moonPosition = useMemo(() => location.status === 'success'
    ? getMoonPosition(location.location.latitude, location.location.longitude, now) : null, [location, now])
  const ready = calibrated && northCorrection !== null && Number.isFinite(northCorrection)
  const isBelowHorizon = moonPosition !== null && !moonPosition.isAboveHorizon
  // 非稼働状態の姿勢は、値が残っていても月の位置や案内に利用しない。
  const deviceState = getMoonDeviceState(orientation, ready && orientation.status === 'active' ? northCorrection : null, moonPosition, orientation.compassHeading)
  const cameraForward = deviceState.correctedRotation ? getCameraForward(deviceState.correctedRotation) : null
  const viewAngles = cameraForward ? cameraVectorToViewAngles(cameraForward) : null
  const poseStability = usePoseStability({ rotation: deviceState.correctedRotation, heading: deviceState.correctedHeading,
    active: orientation.status === 'active', sampleId: diagnostics?.lastAccepted?.sequence ?? diagnostics?.lastAccepted?.receivedAt ?? null,
    calibrationKey: ready ? northCorrection : null, motion, gravityConvention })
  const { guidance, isNear, isCentered } = getARConfidentGuidance(deviceState.navigation, poseStability, isBelowHorizon)
  const isPoseChecking = Boolean(ready && orientation.status === 'active' && deviceState.correctedRotation && poseStability.status !== 'stable')
  const parallax = useSkyParallax({
    heading: viewAngles?.heading ?? null,
    altitude: viewAngles?.altitude ?? null,
  })
  const moonScreen = deviceState.moonInDevice ? projectMoonToScreen(deviceState.moonInDevice) : null
  const moonEdge = moonScreen && !moonScreen.visible ? getMoonEdgePosition(moonScreen) : null
  const moonBehind = guidance?.status === 'behind'

  return { now, moonPhase, moonPosition, timeMode: mode, ready, needsRecalibration, isBelowHorizon, orientation, requestPermission, retryConnection, deviceState,
    guidance, isNear, isCentered, parallax, moonScreen, moonEdge, moonBehind, poseStability, isPoseChecking,
    motion, requestMotionPermission, canCheckMotion: gravityConvention !== null }
}
