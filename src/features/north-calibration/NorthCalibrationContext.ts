import { createContext } from 'react'
import type { NorthCalibration } from './horizontalCalibration'

export type NorthCalibrationContextValue = {
  northCorrection: number | null
  calibrated: boolean
  calibratedAt: number | null
  needsRecalibration: boolean
  saveNorthCalibration: (calibration: NorthCalibration) => void
}

export const NorthCalibrationContext = createContext<NorthCalibrationContextValue | null>(null)
