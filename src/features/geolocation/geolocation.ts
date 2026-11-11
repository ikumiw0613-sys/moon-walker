import type { UserLocation } from './types'

export const GEOLOCATION_OPTIONS = { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 } as const

export class GeolocationRequestError extends Error {
  readonly code: number | null

  constructor(message: string, code: number | null = null) {
    super(message)
    this.name = 'GeolocationRequestError'
    this.code = code
  }
}


function getErrorMessage(code: number): string {
  switch (code) {
    case 1:
      return '位置情報の利用が許可されていません。ブラウザの設定で許可して、もう一度お試しください。'
    case 2:
      return '現在地を取得できませんでした。端末の位置情報設定や通信環境を確認して、もう一度お試しください。'
    case 3:
      return '現在地の取得に時間がかかっています。場所を変えるなどして、もう一度お試しください。'
    default:
      return '現在地を取得できませんでした。もう一度お試しください。'
  }
}

export function getCurrentLocation(onEvent?: (event: 'request started' | 'success callback' | 'error callback', detail?: { code: number; message: string }) => void): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(new Error('現在地の取得にはHTTPSでのアクセスが必要です。'))
      return
    }

    if (!navigator.geolocation) {
      reject(new Error('このブラウザは位置情報の取得に対応していません。'))
      return
    }

    onEvent?.('request started')
    navigator.geolocation.getCurrentPosition(
      ({ coords, timestamp }) => {
        onEvent?.('success callback')
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
          altitude: coords.altitude != null && Number.isFinite(coords.altitude) ? coords.altitude : null,
          accuracy: coords.accuracy,
          timestamp,
        })
      },
      (error) => {
        onEvent?.('error callback', { code: error.code, message: error.message })
        reject(new GeolocationRequestError(getErrorMessage(error.code), error.code))
      },
      GEOLOCATION_OPTIONS,
    )
  })
}
