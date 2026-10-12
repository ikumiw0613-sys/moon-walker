import { useState } from 'react'
import type { useDeviceOrientation } from '../device-orientation/useDeviceOrientation'

export function useManualOrientation(sensorOrientation: ReturnType<typeof useDeviceOrientation>['state']) {
  const [manualOrientationEnabled, setManualOrientationEnabled] = useState(false)
  const [manualOrientation, setManualOrientation] = useState({ alpha: 0, beta: 90, gamma: 0 })
  const orientation = manualOrientationEnabled
    ? {
      ...sensorOrientation,
      ...manualOrientation,
      status: 'active' as const,
      absolute: true,
      compassHeading: null,
      message: 'PCテスト中です。スライダーで端末の向きを変更できます。',
    }
    : sensorOrientation
  return { manualOrientationEnabled, setManualOrientationEnabled, manualOrientation, setManualOrientation, orientation }
}
