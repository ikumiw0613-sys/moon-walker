import { AppLink, AppNavigation } from '../components/AppNavigation'
import type { Navigate } from '../components/AppNavigation'
import './Frontend.css'

export function HomePage({ navigate }: { navigate: Navigate }) {
  return (
    <main className="mw-screen mw-home">
      <header className="mw-top"><span className="mw-wordmark">moon-walker<span aria-hidden="true">✦</span></span><span className="mw-kicker">LOOK UP, SLOW DOWN</span></header>
      <section className="mw-home-content" aria-labelledby="app-title">
        <div className="mw-orbit" aria-hidden="true"><div className="mw-moon" /><span className="mw-orbit-star">✦</span></div>
        <p className="mw-eyebrow">空を見上げる、小さな旅。</p>
        <h1 id="app-title">今夜、月に<br />会いにいこう。</h1>
        <p className="mw-description">スマホを空に向けて。<br />月のある場所まで、そっとご案内します。</p>
        <AppLink to="/calibration" navigate={navigate} className="mw-primary">月を探す <span aria-hidden="true">↗</span></AppLink>
        <p className="mw-caption">あなたのいる場所から、夜空へ。</p>
      </section>
      <AppNavigation navigate={navigate} active="/" />
    </main>
  )
}
