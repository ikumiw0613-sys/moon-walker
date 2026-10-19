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
  requestLocation: () => Promise<void>
}
