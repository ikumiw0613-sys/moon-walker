import { useEffect, useMemo, useState } from 'react'
import { AppLink, AppNavigation } from '../components/AppNavigation'
import type { Navigate } from '../components/AppNavigation'
import type { useGeolocation } from '../hooks/useGeolocation'
import { getMoonPosition, getNextMoonrise } from '../lib/astronomy'
import { formatMoonrise } from '../lib/formatMoonrise'
import './Frontend.css'

export function HomePage({ navigate, state, requestLocation }: { navigate: Navigate } & ReturnType<typeof useGeolocation>) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (state.status === 'idle') void requestLocation()
  }, [state.status, requestLocation])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 10000)
    const refresh = () => setNow(new Date())
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
  return (
    <main className="mw-screen mw-home">
      <header className="mw-top"><span className="mw-wordmark">moon-walker<span aria-hidden="true">✦</span></span><span className="mw-kicker">LOOK UP, SLOW DOWN</span></header>
      <section className="mw-home-content" aria-labelledby="app-title">
        <div className="mw-orbit" aria-hidden="true"><div className="mw-moon" /><span className="mw-orbit-star">✦</span></div>
        <p className="mw-eyebrow">空を見上げる、小さな旅。</p>
        <h1 id="app-title">今夜、月に<br />会いにいこう。</h1>
        <p className="mw-description">スマホを空に向けて。<br />月のある場所まで、そっとご案内します。</p>
        <div className="mw-home-moon-status" role="status" aria-live="polite">
          <p className="mw-home-moon-label">現在地の月</p>
          {moon ? <>
            <p className="mw-home-moon-title">{moon.isAboveHorizon ? '今、月が出ています' : '今、月はまだ出ていません'}</p>
            <p className="mw-home-moon-note">{moon.isAboveHorizon
              ? '月は地平線より上にあります。'
              : moon.nextRise ? `次の月の出は ${formatMoonrise(moon.nextRise, now)}です。` : '今後30日以内の月の出はありません。'}</p>
            <p className="mw-home-moon-note">天気や建物、山によって見えないことがあります。</p>
          </> : <>
            <p className="mw-home-moon-title">{state.status === 'error' ? '月の状態を確認できません' : '現在地の月を確認しています…'}</p>
            {state.status === 'error' && <>
              <p className="mw-home-moon-note">{state.message}</p>
              <button type="button" className="mw-home-location-button" onClick={() => void requestLocation()}>現在地を再取得</button>
            </>}
          </>}
        </div>
        <AppLink to="/calibration" navigate={navigate} className="mw-primary">月を探す <span aria-hidden="true">↗</span></AppLink>
        <p className="mw-caption">あなたのいる場所から、夜空へ。</p>
      </section>
      <AppNavigation navigate={navigate} active="/" />
    </main>
  )
}
