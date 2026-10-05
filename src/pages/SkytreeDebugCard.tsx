import { TOKYO_SKYTREE } from '../constants/landmarks'
import { calculateBearing, calculateDistance, compareHeadingToBearing } from '../lib/geographicBearing'
import type { LocationState } from '../types/geolocation'

export function SkytreeDebugCard({ state, correctedHeading }: { state: LocationState; correctedHeading: number | null }) {
  const location = state.status === 'success' ? state.location : null
  const skytreeBearing = location
    ? calculateBearing(location.latitude, location.longitude, TOKYO_SKYTREE.latitude, TOKYO_SKYTREE.longitude) : null
  const distance = location
    ? calculateDistance(location.latitude, location.longitude, TOKYO_SKYTREE.latitude, TOKYO_SKYTREE.longitude) : null
  const comparison = compareHeadingToBearing(correctedHeading, skytreeBearing)
  const headingErrorToSkytree = comparison?.headingError ?? null
  const degrees = (value: number | null) => value !== null && Number.isFinite(value) ? `${value.toFixed(1)}°` : '—'

  return (
    <section className="debug-panel" aria-labelledby="skytree-title">
      <h2 id="skytree-title">東京スカイツリー検証</h2>
      <dl className="debug-data">
        <div><dt>現在地（緯度 / 経度）</dt><dd>{location ? `${location.latitude.toFixed(7)} / ${location.longitude.toFixed(7)}` : '—'}</dd></div>
        <div><dt>現在地の推定精度</dt><dd>{location ? `約${location.accuracy.toFixed(0)} m` : '—'}</dd></div>
        <div><dt>スカイツリー（緯度 / 経度）</dt><dd>{TOKYO_SKYTREE.latitude} / {TOKYO_SKYTREE.longitude}</dd></div>
        <div><dt>スカイツリーまでの地表距離</dt><dd>{distance === null ? '—' : distance < 1000 ? `${distance.toFixed(1)} m` : `${(distance / 1000).toFixed(2)} km`}</dd></div>
        <div><dt>スカイツリー方位（skytreeBearing）</dt><dd>{degrees(skytreeBearing)}</dd></div>
        <div><dt>スマホ方位（correctedHeading）</dt><dd>{degrees(correctedHeading)}</dd></div>
        <div><dt>誤差（headingErrorToSkytree）</dt><dd>{degrees(headingErrorToSkytree)}</dd></div>
      </dl>
      <p className="search-status" role="status">
        {!location ? '現在地を取得してください。'
          : skytreeBearing === null ? '方位を確定できません（同一点など）。'
            : !comparison ? '北補正をキャリブレーションして、端末の向きを取得してください。'
              : `${comparison.assessment} / ${comparison.guidance}`}
      </p>
      <p className="search-status">誤差の目安：5°以内「かなり近い」、10°以内「概ね一致」、それ以上「ズレあり」。</p>
      <p className="debug-diagnostic-note">
        北補正後、画面中央を実際のスカイツリーへ向け、誤差を記録してください。
        誤差は「スマホ方位 − スカイツリー方位」。正なら左へ、負なら右へ向きを調整します。
        方位は真北基準です。既存の補正が磁北基準の場合、その差も誤差に含まれます。
      </p>
    </section>
  )
}
