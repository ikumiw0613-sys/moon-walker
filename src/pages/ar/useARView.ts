import { useEffect, useMemo, useState } from 'react'
import { useDeviceOrientation } from '../../features/device-orientation/useDeviceOrientation'
import { useNorthCalibration } from '../../features/north-calibration/useNorthCalibration'
import { getMoonPosition } from '../../features/moon/astronomy'
import { getObservationTime } from '../../shared/time/observationTime'
import { getMoonDeviceState } from '../../features/moon-guide/moonDeviceNavigation'

import { useSkyParallax } from '../../features/sky/useSkyParallax'
import {
  getCameraForward,
  cameraVectorToViewAngles,
} from '../../features/sky/skyParallax'

import { getMoonEdgePosition, projectMoonToScreen } from '../../features/moon-guide/moonProjection'

import type { LocationState } from '../../features/geolocation/types'

export function useARView(location: LocationState) {
  const { northCorrection, calibrated } = useNorthCalibration()
  const { state: orientation, requestPermission } = useDeviceOrientation({ autoStart: true })
  const [now, setNow] = useState(getObservationTime)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(getObservationTime()), 10000)
    return () => window.clearInterval(timer)
  }, [])
  const moonPosition = useMemo(() => location.status === 'success'
    ? getMoonPosition(location.location.latitude, location.location.longitude, now) : null, [location, now])
  const ready = calibrated && northCorrection !== null && Number.isFinite(northCorrection)
  const isBelowHorizon = moonPosition !== null && !moonPosition.isAboveHorizon
  const deviceState = getMoonDeviceState(orientation, ready ? northCorrection : null, moonPosition, orientation.compassHeading)
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

  return { now, ready, isBelowHorizon, orientation, requestPermission, deviceState,
    guidance, isNear, isCentered, parallax, moonScreen, moonEdge, moonBehind }
}
