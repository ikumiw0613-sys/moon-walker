import { useState } from 'react'
import type { ReactNode } from 'react'
import { ObservationTimeContext } from './ObservationTimeContext'
import type { ObservationTimeMode } from './ObservationTimeContext'

export function ObservationTimeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ObservationTimeMode>('current')
  return <ObservationTimeContext.Provider value={{ mode, setMode }}>{children}</ObservationTimeContext.Provider>
}
