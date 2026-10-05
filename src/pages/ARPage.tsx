import { AppLink } from '../components/AppNavigation'
import type { Navigate } from '../components/AppNavigation'
import './Frontend.css'

export function ARPage({ navigate }: { navigate: Navigate }) {
  return <main className="mw-screen mw-ar" aria-label="月を探すプレビュー">
    <header className="mw-top"><AppLink to="/" navigate={navigate} className="mw-ar-close"><span aria-hidden="true">×</span><span className="mw-sr-only">ホームへ戻る</span></AppLink><span className="mw-kicker">AR PREVIEW</span><AppLink to="/moon-info" navigate={navigate} className="mw-ar-info">月の情報</AppLink></header>
    <div className="mw-ar-target" aria-hidden="true"><span className="mw-target-dot" /><span className="mw-target-line" /></div>
    <div className="mw-ar-guidance"><span className="mw-ar-arrow" aria-hidden="true">↗</span><p>少し右上へ</p><span className="mw-ar-distance">月まで <strong>12°</strong></span></div>
    <p className="mw-ar-footnote">表示はサンプルです</p>
  </main>
}
