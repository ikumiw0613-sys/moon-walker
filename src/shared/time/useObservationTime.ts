import { useContext } from 'react'
import { ObservationTimeContext } from './ObservationTimeContext'
import type { ObservationTimeMode } from './ObservationTimeContext'
import { useCurrentObservationTime } from './useCurrentObservationTime'

const ignoreModeChange = (_mode: ObservationTimeMode) => {}

export function useObservationTime() {
  const context = useContext(ObservationTimeContext)
  // Providerなしの単独描画にも対応する。共有時刻がある場合、この時計は更新しない。
  const fallback = useCurrentObservationTime(context === null)

  return {
    now: context?.now ?? fallback.now,
    mode: context?.mode ?? 'current',
    changeMode: context?.setMode ?? ignoreModeChange,
  }
}
