import { createContext } from 'react'

export type ObservationTimeMode = 'current' | 'fixed'
export const TEST_OBSERVATION_TIME = new Date('2026-10-11T10:00:00+09:00')

export const ObservationTimeContext = createContext<{
  mode: ObservationTimeMode
  setMode: (mode: ObservationTimeMode) => void
}>({ mode: 'current', setMode: () => {} })
