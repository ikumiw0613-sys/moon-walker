import { useContext, useEffect, useState } from 'react'
import { ObservationTimeContext, TEST_OBSERVATION_TIME } from './ObservationTimeContext'
import { getObservationTime } from './observationTime'

export function useObservationTime() {
  const { mode, setMode } = useContext(ObservationTimeContext)
  const [currentTime, setCurrentTime] = useState(getObservationTime)
  useEffect(() => {
    if (mode !== 'current') return
    const refresh = () => setCurrentTime(getObservationTime())
    const timer = window.setInterval(refresh, 10000)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [mode])

  return {
    now: mode === 'fixed' ? TEST_OBSERVATION_TIME : currentTime,
    mode,
    changeMode: (nextMode: typeof mode) => {
      setCurrentTime(getObservationTime())
      setMode(nextMode)
    },
  }
}
