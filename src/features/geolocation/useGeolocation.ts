import { useEffect, useRef, useState } from 'react'
import { GEOLOCATION_OPTIONS, GeolocationRequestError, getCurrentLocation } from './geolocation'
import type { GeolocationAccess, GeolocationDiagnostics, LocationState } from './types'

function readPermission(): Promise<string> {
  try {
    if (!navigator.permissions?.query) return Promise.resolve('unsupported')
    return navigator.permissions.query({ name: 'geolocation' }).then(result => result.state).catch(() => 'unsupported')
  } catch {
    return Promise.resolve('unsupported')
  }
}

export function useGeolocation(): GeolocationAccess {
  const [state, setState] = useState<LocationState>({ status: 'idle' })
  const [diagnostics, setDiagnostics] = useState<GeolocationDiagnostics>({
    status: 'idle', permission: 'checking', lastError: null, lastSuccess: null,
    requestStarted: null, requestFinished: null, events: [], options: GEOLOCATION_OPTIONS,
  })
  const pending = useRef(false)

  useEffect(() => {
    void readPermission().then(permission => setDiagnostics(current => ({ ...current, permission })))
  }, [])

  function recordEvent(message: string): void {
    const timestamp = Date.now()
    setDiagnostics(current => ({ ...current, events: [...current.events, { message, timestamp }].slice(-10) }))
  }

  async function requestLocation(source?: 'button'): Promise<void> {
    if (pending.current) return
    pending.current = true
    const started = Date.now()
    setState({ status: 'loading' })
    setDiagnostics(current => ({ ...current, status: 'requesting', lastError: null, requestStarted: started, requestFinished: null }))
    recordEvent(source === 'button' ? 'button clicked' : 'location request invoked')
    void readPermission().then(permission => setDiagnostics(current => ({ ...current, permission })))

    try {
      const location = await getCurrentLocation((event, detail) => {
        recordEvent(event)
        if (event === 'error callback' && detail) {
          setDiagnostics(current => ({ ...current, lastError: { code: detail.code, message: detail.message } }))
        }
      })
      setState({ status: 'success', location })
      setDiagnostics(current => ({ ...current, status: 'success', lastSuccess: location, requestFinished: Date.now() }))
    } catch (error: unknown) {
      const geoError = error instanceof GeolocationRequestError ? error : null
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
      setDiagnostics(current => ({
        ...current, status: 'error', requestFinished: Date.now(),
        lastError: current.lastError ?? { code: geoError?.code ?? null, message: error instanceof Error ? error.message : String(error) },
      }))
    } finally {
      pending.current = false
    }
  }

  return { state, requestLocation, diagnostics }
}
