import { AppLink, AppNavigation } from '../components/AppNavigation'
import type { Navigate } from '../components/AppNavigation'
import './Frontend.css'

const SAMPLE_MOON = [
  { label: '方位角', value: '123.4', unit: '°', detail: '南東の空' },
  { label: '高度', value: '38.2', unit: '°', detail: '地平線からの角度' },
  { label: '月齢', value: '12.8', unit: '日', detail: '満月までもう少し' },
  { label: '月までの距離', value: '384,400', unit: 'km', detail: '地球からの距離' },
] as const

export function MoonInfoPage({ navigate }: { navigate: Navigate }) {
  return <main className="mw-screen mw-detail">
    <header className="mw-top"><AppLink to="/" navigate={navigate} className="mw-back">← ホーム</AppLink><span className="mw-kicker">THE MOON</span></header>
    <section className="mw-detail-content" aria-labelledby="moon-info-title">
      <p className="mw-eyebrow">遠くて、身近な存在。</p><h1 id="moon-info-title">月の情報</h1>
      <div className="mw-info-moon" aria-hidden="true"><div className="mw-moon" /></div>
      <p className="mw-sample-label">サンプルデータ</p>
      <dl className="mw-moon-facts">{SAMPLE_MOON.map(({ label, value, unit, detail }) => <div key={label}><dt>{label}<span>{detail}</span></dt><dd>{value}<span>{unit}</span></dd></div>)}</dl>
      <AppLink to="/calibration" navigate={navigate} className="mw-secondary">月を探しにいく <span aria-hidden="true">↗</span></AppLink>
    </section>
    <AppNavigation navigate={navigate} active="/moon-info" />
  </main>
}
