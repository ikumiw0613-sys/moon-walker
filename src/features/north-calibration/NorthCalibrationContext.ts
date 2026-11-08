import { createContext } from 'react'
import type { NorthCalibration } from './horizontalCalibration'
import type { RecalibrationRecommendationReason, RequiredRecalibrationReason } from './recalibrationPolicy'

export type NorthCalibrationContextValue = {
  northCorrection: number | null
  calibrated: boolean
  calibratedAt: number | null
  needsRecalibration: boolean
  requiredRecalibrationReason: RequiredRecalibrationReason | null
  recalibrationRecommended: boolean
  recalibrationRecommendationReasons: RecalibrationRecommendationReason[]
  recommendRecalibration: (reason: RecalibrationRecommendationReason) => void
  dismissRecalibrationRecommendation: () => void
  requireNorthRecalibration: (reason: RequiredRecalibrationReason) => void
  saveNorthCalibration: (calibration: NorthCalibration) => void
}

export const NorthCalibrationContext = createContext<NorthCalibrationContextValue | null>(null)
