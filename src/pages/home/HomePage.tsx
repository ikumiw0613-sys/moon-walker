import { useEffect, useMemo, useState } from 'react'
import { AppLink } from '../../app/navigation/AppNavigation'
import type { Navigate } from '../../app/navigation/AppNavigation'
import type { GeolocationAccess } from '../../features/geolocation/types'
import { getMoonPosition, getNextMoonrise } from '../../features/moon/astronomy'
import { formatMoonrise } from '../../features/moon/formatMoonrise'
import { getObservationTime } from '../../shared/time/observationTime'
import '../../shared/styles/frontend.css'
import './HomePage.css'

export function HomePage({ navigate, state, requestLocation }: { navigate: Navigate } & GeolocationAccess) {
  const [now, setNow] = useState(getObservationTime)
  useEffect(() => {
    if (state.status === 'idle') void requestLocation()
  }, [state.status, requestLocation])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(getObservationTime()), 10000)
    const refresh = () => setNow(getObservationTime())
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  const moon = useMemo(() => {
    if (state.status !== 'success') return null
    const { latitude, longitude } = state.location
    const position = getMoonPosition(latitude, longitude, now)
    return { ...position, nextRise: position.isAboveHorizon ? null : getNextMoonrise(latitude, longitude, now) }
  }, [state, now])
  useEffect(() => {
    if (moon?.isAboveHorizon) navigate('/calibration', { replace: true })
  }, [moon?.isAboveHorizon, navigate])
  return (
    <main className="mw-screen mw-home">
      <section className="mw-home-content mw-waiting-content" aria-labelledby="app-title">
        <div role="status" aria-live="polite">
          {moon ? <>
            <h1 id="app-title">{moon.isAboveHorizon ? '月を探す準備に進みます' : '今は月が見えません'}</h1>
            {!moon.isAboveHorizon && <div className="mw-waiting-next">
              <p className="mw-waiting-label">次に見えるのは</p>
              <p className="mw-waiting-time">{moon.nextRise ? formatMoonrise(moon.nextRise, now) : '今後30日以内の月の出はありません'}</p>
            </div>}
          </> : <>
            <h1 id="app-title">{state.status === 'error' ? '月の状態を確認できません' : '現在地の月を確認しています…'}</h1>
            {state.status === 'error' && <>
              <p className="mw-home-moon-note">{state.message}</p>
              <button type="button" className="mw-home-location-button" onClick={() => void requestLocation()}>現在地を再取得</button>
            </>}
          </>}
        </div>
        <AppLink to="/moon-info" navigate={navigate} className="mw-primary mw-waiting-link">月の情報を見る</AppLink>
      </section>
    </main>
  )
}
