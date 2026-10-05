import { useState } from 'react'
import type { ReactNode } from 'react'
import type { NorthCalibration } from '../lib/horizontalCalibration'
import { NorthCalibrationContext } from '../hooks/useNorthCalibration'

export function NorthCalibrationProvider({ children }: { children: ReactNode }) {
  // App lifetime only: route changes preserve this state; a reload starts at null.
  const [calibration, setCalibration] = useState<NorthCalibration | null>(null)

  return (
    <NorthCalibrationContext.Provider value={{
      northCorrection: calibration?.northCorrection ?? null,
      calibrated: calibration !== null,
      calibratedAt: calibration?.calibratedAt ?? null,
      saveNorthCalibration: setCalibration,
    }}>
      {children}
    </NorthCalibrationContext.Provider>
  )
}

