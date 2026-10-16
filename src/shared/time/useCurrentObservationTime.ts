import { useCallback, useEffect, useState } from 'react'
import { getObservationTime } from './observationTime'

const UPDATE_INTERVAL_MS = 10000

/** 現在時刻の更新処理。固定日時の使用中はタイマーと復帰イベントを停止する。 */
export function useCurrentObservationTime(enabled: boolean, updateIntervalMs = UPDATE_INTERVAL_MS) {
  const [now, setNow] = useState(getObservationTime)
  const refresh = useCallback(() => setNow(getObservationTime()), [])

  useEffect(() => {
    if (!enabled) return
    const timer = window.setInterval(refresh, updateIntervalMs)
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
  }, [enabled, refresh, updateIntervalMs])

  return { now, refresh }
}
