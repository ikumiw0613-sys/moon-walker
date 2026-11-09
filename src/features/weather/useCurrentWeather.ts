import { useEffect, useState } from 'react'
import type { LocationState } from '../geolocation/types'
import { getCurrentWeather } from './openMeteo'
import type { CurrentWeather } from './openMeteo'

type WeatherState =
  | { status: 'idle' | 'loading' }
  | { status: 'success'; weather: CurrentWeather }
  | { status: 'error'; message: string }

export function useCurrentWeather(locationState: LocationState) {
  const latitude = locationState.status === 'success' ? locationState.location.latitude : null
  const longitude = locationState.status === 'success' ? locationState.location.longitude : null
  const key = latitude !== null && longitude !== null ? `${latitude},${longitude}` : null
  const [result, setResult] = useState<{ key: string | null; state: WeatherState }>({ key: null, state: { status: 'idle' } })
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (latitude === null || longitude === null) return
    let active = true
    let controller: AbortController | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined

    async function refresh() {
      controller?.abort()
      clearTimeout(timeout)
      const request = new AbortController()
      controller = request
      setResult({ key, state: { status: 'loading' } })
      timeout = setTimeout(() => request.abort(), 12_000)
      try {
        const weather = await getCurrentWeather(latitude!, longitude!, request.signal)
        if (active && controller === request) setResult({ key, state: { status: 'success', weather } })
      } catch {
        if (active && controller === request) {
          setResult({ key, state: { status: 'error', message: '天気を取得できませんでした。通信状態を確認して再取得してください。' } })
        }
      } finally {
        if (controller === request) clearTimeout(timeout)
      }
    }

    void refresh()
    const interval = setInterval(() => void refresh(), 15 * 60_000)
    return () => {
      active = false
      controller?.abort()
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [latitude, longitude, key, revision])

  const state: WeatherState = key === null ? { status: 'idle' }
    : result.key !== key ? { status: 'loading' } : result.state
  return { state, refresh: () => setRevision(value => value + 1) }
}
