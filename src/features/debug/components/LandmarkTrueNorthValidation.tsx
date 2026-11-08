import { diagnosticDegrees as degrees, diagnosticSignedDegrees as signed } from '../formatDiagnostics'
import { HEADING_REFERENCE_LIMITS } from '../landmarkTrueNorthDiagnostics'
import type { LandmarkTrueNorthDiagnostics } from '../landmarkTrueNorthDiagnostics'
import { YOMIURILAND_REFERENCE } from '../landmarks'

const coordinate = (value: number | null) => value === null ? 'unavailable' : value.toFixed(7)
const diagnosticDistance = (value: number | null) => value === null ? 'unavailable'
  : value < 1000 ? `${value.toFixed(1)} m` : `${(value / 1000).toFixed(2)} km`

export function LandmarkTrueNorthReadout({ data }: { data: LandmarkTrueNorthDiagnostics }) {
  return <>
    <dl className="debug-data debug-landmark-primary">
      <div><dt>Reference target</dt><dd>{data.referenceTarget}</dd></div>
      <div><dt>True bearing</dt><dd>{degrees(data.trueBearing)}</dd></div>
      <div><dt>webkitCompassHeading</dt><dd>{degrees(data.webkitCompassHeading)}</dd></div>
      <div><dt>Difference (heading − true bearing)</dt><dd>{signed(data.compassDifference)}</dd></div>
      <div><dt>Absolute difference</dt><dd>{degrees(data.absoluteDifference)}</dd></div>
      <div><dt>Magnetic declination (east + / west −)</dt><dd>{signed(data.magneticDeclination)}</dd></div>
      <div><dt>Expected magnetic difference (−declination)</dt><dd>{signed(data.magneticDeclination === null ? null : -data.magneticDeclination)}</dd></div>
      <div><dt>Magnetic residual (difference + declination)</dt><dd>{signed(data.magneticDifference)}</dd></div>
      <div><dt>webkitCompassAccuracy</dt><dd>{degrees(data.webkitCompassAccuracy)}</dd></div>
      <div><dt>correctedHeading（参考値）</dt><dd>{degrees(data.correctedHeading)}</dd></div>
      <div><dt>correctedHeading vs true bearing</dt><dd>{signed(data.correctedHeadingDifference)}</dd></div>
      <div><dt>Distance</dt><dd>{diagnosticDistance(data.distance)}</dd></div>
      <div><dt>Heading reference hypothesis（仮判定）</dt><dd><strong className={`debug-quality is-${data.headingReferenceHypothesis === 'INCONCLUSIVE' ? 'caution' : 'good'}`}>{data.headingReferenceHypothesis}</strong></dd></div>
    </dl>
    {data.unavailableReason && <p className="search-status" role="status">{data.unavailableReason}</p>}
    {data.gpsSensitive && <p className="search-status" role="status">GPS誤差の影響を受けやすい距離・位置精度のため、仮判定はINCONCLUSIVEです。目標から離れて再測定してください。</p>}
    {data.webkitCompassAccuracy !== null && data.webkitCompassAccuracy < 0 && <p className="search-status">webkitCompassAccuracyは負の生値です（端末の精度情報は無効）。</p>}
    <details className="debug-details"><summary>WMM・座標・測定時刻の詳細</summary>
      <dl className="debug-data">
        <div><dt>Current latitude / longitude</dt><dd>{coordinate(data.currentLatitude)} / {coordinate(data.currentLongitude)}</dd></div>
        <div><dt>Target latitude / longitude</dt><dd>{coordinate(data.targetLatitude)} / {coordinate(data.targetLongitude)}</dd></div>
        <div><dt>GPS accuracy</dt><dd>{data.locationAccuracy === null ? 'unavailable' : `${data.locationAccuracy.toFixed(1)} m`}</dd></div>
        <div><dt>GPS由来の方位不確かさ目安</dt><dd>{degrees(data.gpsBearingUncertainty)}</dd></div>
        <div><dt>Model name</dt><dd>{data.modelName ?? 'unavailable'}</dd></div>
        <div><dt>Model epoch</dt><dd>{data.modelEpoch ?? 'unavailable'}</dd></div>
        <div><dt>Model date (UTC / 実際の現在日時)</dt><dd>{data.modelDate ?? 'unavailable'}</dd></div>
        <div><dt>Model validity (UTC)</dt><dd>{data.modelValidFrom ?? 'unavailable'} / {data.modelValidTo ?? 'unavailable'}</dd></div>
        <div><dt>Model altitude</dt><dd>{data.modelAltitudeMeters} m（WGS84楕円体高を仮定）</dd></div>
        <div><dt>Model unavailable reason</dt><dd>{data.modelUnavailableReason ?? 'なし'}</dd></div>
        <div><dt>timestamp (UTC)</dt><dd>{new Date(data.timestamp).toISOString()}</dd></div>
      </dl>
    </details>
  </>
}

export function LandmarkTrueNorthValidation({ data }: { data: LandmarkTrueNorthDiagnostics }) {
  return <section className="debug-panel debug-landmark" aria-labelledby="true-north-validation-title">
    <h2 id="true-north-validation-title">Landmark / True North Validation</h2>
    <p className="debug-diagnostic-note">実際のランドマークへスマホ背面を向け、数秒静止してください。True bearing と webkitCompassHeading を比較します。観覧車の中心に合わせ、動くゴンドラは狙わないでください。</p>
    <LandmarkTrueNorthReadout data={data} />
    <p className="search-status">仮判定のみです。差の絶対値が{HEADING_REFERENCE_LIMITS.toleranceDegrees}°以内ならTRUE-NORTH-LIKE、difference + declinationの絶対値が{HEADING_REFERENCE_LIMITS.toleranceDegrees}°以内ならMAGNETIC-NORTH-LIKE。両方一致・どちらも不一致・データ不足はINCONCLUSIVEです。</p>
    <p className="search-status">WMMは東偏＋／西偏−。磁北値なら heading − true bearing ≈ −declination です（例: 真方位245.8°、偏角−7.5°なら磁北値253.3°）。端末への別の補正や磁気干渉もあり得るため、一度の一致では断定できません。</p>
    <p className="search-status">{HEADING_REFERENCE_LIMITS.minimumDistanceMeters}m未満は仮判定停止、{HEADING_REFERENCE_LIMITS.distanceWarningMeters}m未満またはGPS由来の方位不確かさが{HEADING_REFERENCE_LIMITS.gpsWarningDegrees}°超なら警告します。座標は測量済みの軸中心ではなく<a href={YOMIURILAND_REFERENCE.sourceUrl} target="_blank" rel="noreferrer">施設監修ページの地図代表点</a>です。WMMは周囲の金属・磁石による局所的な干渉を再現しません。</p>
    <p className="search-status">診断専用です。磁気偏角をコンパス・northCorrection・キャリブレーション・AR・月の計算へ適用しません。</p>
  </section>
}
