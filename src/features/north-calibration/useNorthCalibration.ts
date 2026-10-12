import { useContext } from 'react'
import { NorthCalibrationContext } from './NorthCalibrationContext'
import type { NorthCalibrationContextValue } from './NorthCalibrationContext'

export function useNorthCalibration(): NorthCalibrationContextValue {
  const context = useContext(NorthCalibrationContext)
  if (!context) throw new Error('useNorthCalibration requires NorthCalibrationProvider')
  return context
}
