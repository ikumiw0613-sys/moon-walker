import type { LocationState } from '../geolocation/types'
import { describeWeather } from './openMeteo'
import { useCurrentWeather } from './useCurrentWeather'
import './WeatherCard.css'

export function WeatherCard({ locationState, fixedObservationTime = false }: { locationState: LocationState; fixedObservationTime?: boolean }) {
  const { state, refresh } = useCurrentWeather(locationState)
  return <section className="mw-weather" aria-labelledby="weather-title" aria-busy={state.status === 'loading'}>
    <div className="mw-weather-heading">
      <h2 id="weather-title">現在地の天気</h2>
      {locationState.status === 'success' && <button type="button" disabled={state.status === 'loading'} onClick={refresh}>
        {state.status === 'loading' ? '取得中…' : '天気を再取得'}
      </button>}
    </div>
    <div role="status" aria-live="polite">
      {state.status === 'idle' && <p className="mw-weather-note">現在地を取得すると天気を表示します。</p>}
      {state.status === 'loading' && <p className="mw-weather-note">天気を取得しています…</p>}
      {state.status === 'error' && <p className="mw-weather-note">{state.message}</p>}
      {state.status === 'success' && <>
        <p className="mw-weather-condition">{describeWeather(state.weather.weatherCode)}</p>
        <p className="mw-weather-cloud-cover">雲量 {state.weather.cloudCover === null ? '—' : `${Math.round(state.weather.cloudCover)}%`}</p>
        <p className="mw-weather-note">対象時刻：<time dateTime={state.weather.time.toISOString()}>{state.weather.time.toLocaleString('ja-JP', {
          timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
        })}</time>（日本時間）</p>
      </>}
    </div>
    {fixedObservationTime && <p className="mw-weather-note">天気はテスト日時ではなく、現在の情報です。</p>}
    <p className="mw-weather-source">気象モデルによる推定値 · <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a></p>
  </section>
}
