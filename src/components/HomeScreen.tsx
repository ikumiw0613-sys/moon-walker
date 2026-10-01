import { useLocation } from '../hooks/useLocation'

export function HomeScreen() {
  const { state, requestLocation } = useLocation()
  const isLoading = state.status === 'loading'
  const statusMessage = state.status === 'error'
    ? state.message
    : state.status === 'success'
      ? '現在地を取得しました。月の位置を案内する機能は準備中です。'
      : isLoading
        ? '現在地を取得しています。許可を求められたら、位置情報の利用を許可してください。'
        : '位置情報の利用を許可すると、現在地を取得します。'

  return (
    <main className="home-screen">
      <section className="home-content" aria-labelledby="app-title">
        <span className="moon" aria-hidden="true" />
        <h1 id="app-title">moon-walker</h1>
        <p className="home-description">
          今いる場所から月を見つけるWebアプリ。
          <br />
          顔を上げて、月を探してみよう。
        </p>
        <div className="home-action">
          <button
            className="find-moon-button"
            type="button"
            disabled={isLoading}
            onClick={() => void requestLocation()}
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
      </section>
    </main>
  )
}
