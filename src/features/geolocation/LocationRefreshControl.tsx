import type { GeolocationAccess } from './types'
import './LocationRefreshControl.css'

export function LocationRefreshControl({ state, requestLocation }: GeolocationAccess) {
  const loading = state.status === 'loading'
  const location = state.status === 'success' ? state.location : null
  const timestamp = location && Number.isFinite(location.timestamp) ? new Date(location.timestamp) : null

  return <section className="mw-location-refresh" aria-label="現在地の取得">
    <button type="button" disabled={loading} onClick={() => void requestLocation()}>
      {loading ? '現在地を取得中…' : state.status === 'idle' ? '現在地を取得' : '現在地を再取得'}
    </button>
    <p role="status" aria-live="polite">
      {state.status === 'error' ? state.message
        : loading ? '現在地を取得しています…'
          : location ? <>現在地を取得しました。
            {timestamp && <span>取得時刻：<time dateTime={timestamp.toISOString()}>{timestamp.toLocaleTimeString('ja-JP', {
              timeZone: 'Asia/Tokyo', hour12: false,
            })}</time>（日本時間）</span>}
            {Number.isFinite(location.accuracy) && location.accuracy >= 0 && <span>推定精度：約{Math.round(location.accuracy)} m</span>}
          </> : '現在地を取得すると、この場所から見た月の情報を確認できます。'}
    </p>
  </section>
}
