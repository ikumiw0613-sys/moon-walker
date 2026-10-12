import { useEffect, useMemo, useState } from 'react'
import type { LocationState } from '../geolocation/types'
import { getMoonPosition } from '../moon/astronomy'

// テスト用の固定日。この日から48時間内で月が最も高い時刻を選ぶ。
const TEST_DATE_START = new Date('2026-10-04T00:00:00+09:00')
const TEST_TIME_STEP_MS = 30 * 60 * 1000

export function useDebugObservation(state: LocationState) {
  const [timeMode, setTimeMode] = useState<'fixed' | 'current'>('fixed')
  const [currentDate, setCurrentDate] = useState(() => new Date())

  useEffect(() => {
    if (timeMode !== 'current') return
    const updateTime = () => setCurrentDate(new Date())
    const timer = window.setInterval(updateTime, 1000)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') updateTime()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [timeMode])

  const fixedObservationDate = useMemo(() => {
    if (state.status !== 'success') return null

    const { latitude, longitude } = state.location
    let bestDate = TEST_DATE_START
    let highestAltitude = -Infinity
    for (let step = 0; step < 96; step += 1) {
      const date = new Date(TEST_DATE_START.getTime() + step * TEST_TIME_STEP_MS)
      const { altitude } = getMoonPosition(latitude, longitude, date)
      if (altitude > highestAltitude) {
        highestAltitude = altitude
        bestDate = date
      }
    }
    return bestDate
  }, [state])
  const observationDate = timeMode === 'current' ? currentDate : fixedObservationDate
  const moonPosition = useMemo(() => {
    if (state.status !== 'success' || !observationDate) return null

    const { latitude, longitude } = state.location
    return getMoonPosition(latitude, longitude, observationDate)
  }, [state, observationDate])

  function changeTimeMode(mode: 'fixed' | 'current') {
    if (mode === 'current') setCurrentDate(new Date())
    setTimeMode(mode)
  }
  return { timeMode, changeTimeMode, observationDate, moonPosition }
}
