// Preserve the existing Debug hook API while sharing acquisition with AR confidence checks.
export { useDeviceMotion as useDebugDeviceMotion } from '../device-motion/useDeviceMotion'
export type { MotionState as DebugMotionState } from '../device-motion/useDeviceMotion'
