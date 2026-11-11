export interface UserLocation {
  latitude: number
  longitude: number
  /** Device-reported elevation in meters; absent or null when unavailable. Diagnostics only. */
  altitude?: number | null
  accuracy: number
  timestamp: number
}

export type LocationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; location: UserLocation }
  | { status: 'error'; message: string }

export type GeolocationAccess = {
  state: LocationState
  requestLocation: (source?: 'button') => Promise<void>
  diagnostics?: GeolocationDiagnostics
}

export interface GeolocationDiagnostics {
  status: 'idle' | 'requesting' | 'success' | 'error'
  permission: string
  lastError: { code: number | null; message: string } | null
  lastSuccess: UserLocation | null
  requestStarted: number | null
  requestFinished: number | null
  events: Array<{ message: string; timestamp: number }>
  options: { enableHighAccuracy: boolean; timeout: number; maximumAge: number } | null
}
