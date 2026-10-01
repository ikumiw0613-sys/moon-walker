import type { LocationState } from '../types/geolocation'

interface GeolocationControlsProps {
  state: LocationState
  onRequestLocation: () => Promise<void>
}

export function GeolocationControls({ state, onRequestLocation }: GeolocationControlsProps) {
  const isLoading = state.status === 'loading'
  const statusMessage = state.status === 'error'
    ? state.message
    : state.status === 'success'
      ? '現在地を取得しました。月の位置を案内する機能は準備中です。'
      : isLoading
        ? '現在地を取得しています。許可を求められたら、位置情報の利用を許可してください。'
        : '位置情報の利用を許可すると、現在地を取得します。'

  return (
    <div className="home-action">
      <button
        className="find-moon-button"
        type="button"
        disabled={isLoading}
        onClick={() => void onRequestLocation()}
        aria-describedby="search-status"
      >
        {isLoading ? '現在地を取得中…' : state.status === 'idle' ? '月を探す' : '現在地を再取得'}
      </button>
      <p className="search-status" id="search-status" role="status" aria-live="polite">
        {statusMessage}
      </p>
      {state.status === 'success' && (
        <details className="location-details">
          <summary>取得した位置情報</summary>
          <p>
            緯度 {state.location.latitude.toFixed(4)} / 経度 {state.location.longitude.toFixed(4)}
            <br />
            推定精度：約{Math.round(state.location.accuracy)}m
          </p>
        </details>
      )}
    </div>
  )
}
