import type { getMoonDeviceState } from './moonDeviceNavigation'
import type { PoseStability } from '../device-orientation/poseStability'

export const AR_NEAR_ANGLE_DEGREES = 15

/** Apply confidence to presentation only. Raw navigation and MoonSprite coordinates stay untouched. */
export function getARConfidentGuidance(navigation: ReturnType<typeof getMoonDeviceState>['navigation'],
  stability: Pick<PoseStability, 'status'>, belowHorizon: boolean) {
  const guidance = stability.status === 'stable' && !belowHorizon ? navigation : null
  return { guidance, isNear: guidance !== null && guidance.angleToMoon <= AR_NEAR_ANGLE_DEGREES,
    isCentered: guidance?.status === 'centered' }
}
