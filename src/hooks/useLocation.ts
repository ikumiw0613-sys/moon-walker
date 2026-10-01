import { useRef, useState } from 'react'
import { getCurrentLocation } from '../services/geolocation'
import type { UserLocation } from '../services/geolocation'

type LocationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; location: UserLocation }
  | { status: 'error'; message: string }

export function useLocation() {
  const [state, setState] = useState<LocationState>({ status: 'idle' })
  const pending = useRef(false)

  async function requestLocation(): Promise<void> {
    if (pending.current) return
    pending.current = true
    setState({ status: 'loading' })

    try {
      const location = await getCurrentLocation()
      setState({ status: 'success', location })
    } catch (error: unknown) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : '現在地を取得できませんでした。',
      })
    } finally {
      pending.current = false
    }
  }

  return { state, requestLocation }
}
