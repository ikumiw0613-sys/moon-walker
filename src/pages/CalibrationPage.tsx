import { AppLink } from '../components/AppNavigation'
import type { Navigate } from '../components/AppNavigation'
import { useDeviceOrientation } from '../hooks/useDeviceOrientation'
import { useNorthCalibration } from '../hooks/useNorthCalibration'
import { getHorizontalCalibration, captureNorthCalibration } from '../lib/horizontalCalibration'
import './Frontend.css'

export function CalibrationPage({ navigate }: { navigate: Navigate }) {
  const { state, requestPermission } = useDeviceOrientation()
  const { calibrated, saveNorthCalibration } = useNorthCalibration()
  const measurement = getHorizontalCalibration({ ...state, webkitCompassHeading: state.compassHeading })
  function calibrate() {
    const captured = captureNorthCalibration(measurement, Date.now())
    if (captured) saveNorthCalibration(captured)
  }
  return <main className="mw-screen mw-calibration">
    <header className="mw-top"><AppLink to="/" navigate={navigate} className="mw-back">← ホーム</AppLink><span className="mw-kicker">01 / PREPARE</span></header>
    <section className="mw-calibration-content" aria-labelledby="calibration-title">
      <div className="mw-level-illustration" aria-hidden="true"><div className="mw-phone"><span /></div><div className="mw-level-line" /></div>
      <p className="mw-eyebrow">空を見る、その前に。</p>
      <h1 id="calibration-title">スマホを水平に<br />向けてください</h1>
      <p className="mw-description">端末の向きを合わせて、<br />月を探す準備をしましょう。</p>
      <p className="mw-description">スマホを立て、背面カメラを水平な方向へ向けてください。</p>
      <div className="mw-ar-controls">
        <button type="button" className="mw-primary" disabled={['requesting', 'waiting', 'active'].includes(state.status)} onClick={() => void requestPermission()}>向きセンサーを有効にする</button>
        <p role="status">{state.message}</p>
        <button type="button" className="mw-secondary" disabled={!measurement.canCalibrate} onClick={calibrate}>北基準を保存</button>
      </div>
      <p className="mw-placeholder-note">{calibrated ? '北基準の準備が完了しました' : measurement.canCalibrate ? '北基準を保存してください' : 'カメラを水平に向け、コンパス値の取得を待ってください'}</p>
      <AppLink to="/ar" navigate={navigate} className="mw-primary">準備完了 <span aria-hidden="true">→</span></AppLink>
      <p className="mw-caption">未保存の場合はAR画面で準備が必要と表示します</p>
    </section>
  </main>
}
