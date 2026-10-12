import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { ObservationTimeContext, TEST_OBSERVATION_TIME } from './ObservationTimeContext'
import type { ObservationTimeMode } from './ObservationTimeContext'
import { useCurrentObservationTime } from './useCurrentObservationTime'

export function ObservationTimeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ObservationTimeMode>('current')
  // 各画面で別々の時計を持たず、一つの観測時刻をアプリ全体に配る。
  const { now: currentTime, refresh } = useCurrentObservationTime(mode === 'current')
  const setMode = useCallback((nextMode: ObservationTimeMode) => {
    // 現在時刻に戻る操作では、次の定期更新を待たずに最新の時刻を使う。
    if (nextMode === 'current') refresh()
    setModeState(nextMode)
  }, [refresh])
  const now = mode === 'fixed' ? TEST_OBSERVATION_TIME : currentTime

  return <ObservationTimeContext.Provider value={{ now, mode, setMode }}>{children}</ObservationTimeContext.Provider>
}
