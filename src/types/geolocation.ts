export interface UserLocation {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

export type LocationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; location: UserLocation }
  | { status: 'error'; message: string }
