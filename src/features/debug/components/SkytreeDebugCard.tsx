import { LANDMARK_ACCURACY_LIMITS } from '../landmarkCompassDiagnostics'
import type { LandmarkCompassDiagnostics } from '../landmarkCompassDiagnostics'
import { diagnosticDegrees, diagnosticSignedDegrees } from '../formatDiagnostics'

const degrees = (value: number | null) => value === null ? 'unavailable' : diagnosticDegrees(value)
const coordinate = (value: number | null | undefined) => value != null && Number.isFinite(value) ? value.toFixed(7) : 'unavailable'

/** Extends the existing Skytree card; coordinates and bearing calculation remain shared. */
export function SkytreeDebugCard({ data }: { data: LandmarkCompassDiagnostics }) {
  return <section className="debug-panel debug-landmark" aria-labelledby="skytree-title">
    <h2 id="skytree-title">Landmark compass validation</h2>
    <p className="debug-landmark-accuracy">Landmark Accuracy <strong className={`debug-quality is-${data.landmarkAccuracy.toLowerCase()}`}>{data.landmarkAccuracy}</strong></p>
    <p className="debug-diagnostic-note">実際にスマホの背面を東京スカイツリーへ向けてください。その状態で Reference bearing と webkitCompassHeading を比較します。</p>
    <dl className="debug-data debug-landmark-primary">
      <div><dt>Reference target</dt><dd>{data.referenceTarget}</dd></div>
      <div><dt>Reference bearing</dt><dd>{degrees(data.referenceBearing)}</dd></div>
      <div><dt>webkitCompassHeading</dt><dd>{degrees(data.compassHeading)}</dd></div>
      <div><dt>Compass error / actual error</dt><dd>{diagnosticSignedDegrees(data.compassError)}</dd></div>
      <div><dt>Absolute error</dt><dd>{degrees(data.absoluteError)}</dd></div>
    </dl>
    {data.unavailableReason && <p className="search-status" role="status">{data.unavailableReason}</p>}
    <p className="search-status">目視で向きを合わせた時の絶対方位の検証です。Compass Stabilityは値の時間変動と端末報告の精度を見る診断で、安定していてもLandmark AccuracyがBADになることがあります。</p>
    <details className="debug-details"><summary>現在地・対象・補正後方位・Safari精度の詳細</summary>
      <dl className="debug-data">
        <div><dt>Current location latitude</dt><dd>{coordinate(data.location?.latitude)}</dd></div>
        <div><dt>Current location longitude</dt><dd>{coordinate(data.location?.longitude)}</dd></div>
        <div><dt>現在地の推定精度</dt><dd>{data.location && Number.isFinite(data.location.accuracy) ? `${data.location.accuracy.toFixed(1)} m` : 'unavailable'}</dd></div>
        <div><dt>Target location latitude</dt><dd>{coordinate(data.targetLocation.latitude)}</dd></div>
        <div><dt>Target location longitude</dt><dd>{coordinate(data.targetLocation.longitude)}</dd></div>
        <div><dt>Distance to target</dt><dd>{data.distanceToTarget === null ? 'unavailable'
          : data.distanceToTarget < 1000 ? `${data.distanceToTarget.toFixed(1)} m` : `${(data.distanceToTarget / 1000).toFixed(2)} km`}</dd></div>
        <div><dt>Corrected heading</dt><dd>{degrees(data.correctedHeading)}</dd></div>
        <div><dt>Corrected heading error</dt><dd>{diagnosticSignedDegrees(data.correctedHeadingError)}</dd></div>
        <div><dt>Raw heading（補正前の背面方向）</dt><dd>{degrees(data.rawHeading)}</dd></div>
        <div><dt>webkitCompassAccuracy</dt><dd>{degrees(data.webkitCompassAccuracy)}</dd></div>
      </dl>
      {data.webkitCompassAccuracy !== null && data.webkitCompassAccuracy < 0 && <p className="search-status">webkitCompassAccuracyは負の生値です。Safariの精度情報は無効ですが、ランドマーク誤差とは別に表示します。</p>}
      <p className="search-status">誤差 = 端末方位 − Reference bearing、範囲は[-180°, 180°)。GOOD ≤ {LANDMARK_ACCURACY_LIMITS.good}°、CAUTION ≤ {LANDMARK_ACCURACY_LIMITS.caution}°、それ以上はBAD。判定は丸め前の絶対誤差を使います。</p>
      <p className="search-status">Reference bearingは真北基準の理論方位で、端末が対象を向いているかは目視で合わせる前提です。距離が長いほど数mのGPS誤差の影響は小さくなります。北基準や構え方の差も誤差に含まれるため、月のズレとの比較用として記録してください。自動補正・校正の許否には使いません。</p>
    </details>
  </section>
}
