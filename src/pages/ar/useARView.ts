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

export function useARView(location: LocationState) {
  const { northCorrection, calibrated, needsRecalibration } = useNorthCalibration()
  const { state: orientation, requestPermission, retryConnection } = useDeviceOrientation({ autoStart: true })
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
  const guidance = !isBelowHorizon ? deviceState.navigation : null
  const isNear = guidance !== null && guidance.angleToMoon <= 15
  const isCentered = guidance?.status === 'centered'
  const parallax = useSkyParallax({
    heading: viewAngles?.heading ?? null,
    altitude: viewAngles?.altitude ?? null,
  })
  const moonScreen = deviceState.moonInDevice ? projectMoonToScreen(deviceState.moonInDevice) : null
  const moonEdge = moonScreen && !moonScreen.visible ? getMoonEdgePosition(moonScreen) : null
  const moonBehind = guidance?.status === 'behind'

  return { now, moonPhase, timeMode: mode, ready, needsRecalibration, isBelowHorizon, orientation, requestPermission, retryConnection, deviceState,
    guidance, isNear, isCentered, parallax, moonScreen, moonEdge, moonBehind }
}
