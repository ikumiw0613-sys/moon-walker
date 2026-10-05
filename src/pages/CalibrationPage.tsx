import { AppLink } from '../components/AppNavigation'
import type { Navigate } from '../components/AppNavigation'
import './Frontend.css'

export function CalibrationPage({ navigate }: { navigate: Navigate }) {
  return <main className="mw-screen mw-calibration">
    <header className="mw-top"><AppLink to="/" navigate={navigate} className="mw-back">← ホーム</AppLink><span className="mw-kicker">01 / PREPARE</span></header>
    <section className="mw-calibration-content" aria-labelledby="calibration-title">
      <div className="mw-level-illustration" aria-hidden="true"><div className="mw-phone"><span /></div><div className="mw-level-line" /></div>
      <p className="mw-eyebrow">空を見る、その前に。</p>
      <h1 id="calibration-title">スマホを水平に<br />してください</h1>
      <p className="mw-description">端末の向きを合わせて、<br />月を探す準備をしましょう。</p>
      <div className="mw-placeholder-note"><span className="mw-status-dot" />水平判定は準備中です</div>
      <AppLink to="/ar" navigate={navigate} className="mw-primary">準備完了 <span aria-hidden="true">→</span></AppLink>
      <p className="mw-caption">開発確認用ボタン</p>
    </section>
  </main>
}
