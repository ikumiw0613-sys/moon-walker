import { useEffect, useMemo } from 'react'
import { Body, Illumination, KM_PER_AU } from 'astronomy-engine'
import { AppLink, AppNavigation } from '../../app/navigation/AppNavigation'
import type { Navigate } from '../../app/navigation/AppNavigation'
import type { GeolocationAccess } from '../../features/geolocation/types'
import { getMoonPosition } from '../../features/moon/astronomy'
import { getMoonPhase } from '../../features/moon/moonPhase'
import { MoonDisc } from '../../features/moon/components/MoonDisc'
import { useObservationTime } from '../../shared/time/useObservationTime'
import '../../shared/styles/frontend.css'
import './MoonInfoPage.css'

export function MoonInfoPage({ navigate, state, requestLocation }: { navigate: Navigate } & GeolocationAccess) {
  const { now, mode } = useObservationTime()
  useEffect(() => {
    if (state.status === 'idle') void requestLocation()
  }, [state.status, requestLocation])
  const phase = useMemo(() => getMoonPhase(now), [now])
  // 距離は観測者からではなく、地球の中心から月の中心までの値を表示する。
  const distance = useMemo(() => Illumination(Body.Moon, now).geo_dist * KM_PER_AU, [now])
  const position = useMemo(() => state.status === 'success'
    ? getMoonPosition(state.location.latitude, state.location.longitude, now)
    : null, [state, now])
  const facts = [
    { label: '方位角', value: position ? position.azimuth.toFixed(1) : '—', unit: '°', detail: '現在地から見た方向（北0°・東90°）' },
    { label: '高度', value: position ? position.altitude.toFixed(1) : '—', unit: '°', detail: position ? (position.isAboveHorizon ? '地平線より上にあります' : '地平線より下にあります') : '現在地の取得が必要です' },
    { label: '月齢', value: phase.ageDays.toFixed(1), unit: '日', detail: '直前の新月からの経過日数' },
    { label: '照明率', value: (phase.illuminatedFraction * 100).toFixed(1), unit: '%', detail: '月の見かけの円盤が照らされている割合' },
    { label: '月までの距離', value: Math.round(distance).toLocaleString('ja-JP'), unit: 'km', detail: '地球の中心から月の中心まで' },
  ]
  return <main className="mw-screen mw-detail">
    <header className="mw-top"><AppLink to="/" navigate={navigate} className="mw-back">← ホーム</AppLink><span className="mw-kicker">THE MOON</span></header>
    <section className="mw-detail-content" aria-labelledby="moon-info-title">


      <div className="mw-info-moon" aria-hidden="true"><MoonDisc phase={phase} /></div>
      <p className="mw-observation-label">{mode === 'fixed' ? 'テスト日時' : '観測日時'}：<time dateTime={now.toISOString()}>{now.toLocaleString('ja-JP', { timeZoneName: 'short' })}</time></p>
      <div role="status" aria-live="polite">
        <AppLink to="/calibration" navigate={navigate} className="mw-secondary">月を探しにいく <span aria-hidden="true">↗</span></AppLink>
        {(state.status === 'idle' || state.status === 'loading') && <p>現在地を取得しています…</p>}
        {state.status === 'error' && <><p>{state.message}</p><button type="button" className="mw-secondary" onClick={() => void requestLocation()}>現在地を再取得</button></>}
      </div>
      <dl className="mw-moon-facts">{facts.map(({ label, value, unit, detail }) => <div key={label}><dt>{label}<span>{detail}</span></dt><dd>{value}<span>{unit}</span></dd></div>)}</dl>

    </section>
    <AppNavigation navigate={navigate} active="/moon-info" />
  </main>
}
