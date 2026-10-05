import { AppLink, AppNavigation } from '../components/AppNavigation'
import type { Navigate } from '../components/AppNavigation'
import './Frontend.css'

export function SettingsPage({ navigate }: { navigate: Navigate }) {
  return <main className="mw-screen mw-detail">
    <header className="mw-top"><AppLink to="/" navigate={navigate} className="mw-back">← ホーム</AppLink><span className="mw-kicker">PREFERENCES</span></header>
    <section className="mw-detail-content" aria-labelledby="settings-title">
      <p className="mw-eyebrow">心地よく、空を眺めるために。</p><h1 id="settings-title">設定</h1>
      <p className="mw-description mw-align-left">設定項目は準備中です。</p>
      <dl className="mw-settings-list">
        <div><dt><span className="mw-setting-icon" aria-hidden="true">⌖</span><span>北補正<small>方位の基準を合わせる</small></span></dt><dd>準備中</dd></div>
        <div><dt><span className="mw-setting-icon" aria-hidden="true">◎</span><span>センサー設定<small>端末の向きの取得</small></span></dt><dd>準備中</dd></div>
        <div><dt><span className="mw-setting-icon" aria-hidden="true">◌</span><span>AR表示設定<small>マーカーと方向案内</small></span></dt><dd>準備中</dd></div>
      </dl>
      <p className="mw-settings-signature">moon-walker<span>夜空を、もっと身近に。</span></p>
    </section>
    <AppNavigation navigate={navigate} active="/settings" />
  </main>
}
