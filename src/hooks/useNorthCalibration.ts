import { createContext, useContext } from 'react'
import type { NorthCalibration } from '../lib/horizontalCalibration'

type NorthCalibrationContextValue = {
  northCorrection: number | null
  calibrated: boolean
  calibratedAt: number | null
  saveNorthCalibration: (calibration: NorthCalibration) => void
}

export const NorthCalibrationContext = createContext<NorthCalibrationContextValue | null>(null)

export function useNorthCalibration(): NorthCalibrationContextValue {
  const context = useContext(NorthCalibrationContext)
  if (!context) throw new Error('useNorthCalibration requires NorthCalibrationProvider')
  return context
}
