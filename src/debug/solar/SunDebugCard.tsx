import { useEffect, useMemo, useState } from 'react'
import type { LocationState } from '../../types/geolocation'
import { compareHeadingToBearing } from '../../lib/geographicBearing'
import { getSunPosition } from './sunPosition'
import { SunPreview } from './SunPreview'
import type { Vector3 } from '../../types/vector3'

const UPDATE_INTERVAL_MS = 1000

// DebugPageからだけ読み込む。削除時はこのフォルダと親のimport・JSXを外す。
export function SunDebugCard({ state, correctedHeading, cameraForwardCorrected = null }: { state: LocationState; correctedHeading: number | null; cameraForwardCorrected?: Vector3 | null }) {
  const [date, setDate] = useState(() => new Date())
  useEffect(() => {
    const update = () => setDate(new Date())
    const timer = window.setInterval(update, UPDATE_INTERVAL_MS)
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') update() }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  const sun = useMemo(() => state.status === 'success'
    ? getSunPosition(state.location.latitude, state.location.longitude, date)
    : null, [state, date])
  const comparison = sun?.isAboveHorizon ? compareHeadingToBearing(correctedHeading, sun.azimuth) : null
  const degrees = (value: number | null | undefined) => value != null && Number.isFinite(value) ? `${value.toFixed(1)}°` : '—'

  return (
    <section className="debug-panel" aria-labelledby="sun-debug-title">
      <h2 id="sun-debug-title">太陽の位置・方位検証</h2>
      <p className="search-status">月の固定テスト日時とは独立して、現在時刻で1秒ごとに更新します。</p>
      <dl className="debug-data">
        <div><dt>計算時刻（日本時間）</dt><dd>{date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</dd></div>
        <div><dt>現在地（緯度 / 経度）</dt><dd>{state.status === 'success' ? `${state.location.latitude.toFixed(7)} / ${state.location.longitude.toFixed(7)}` : '—'}</dd></div>
        <div><dt>太陽の方位角（真北基準）</dt><dd>{degrees(sun?.azimuth)}</dd></div>
        <div><dt>太陽の高度</dt><dd>{degrees(sun?.altitude)}</dd></div>
        <div><dt>地平線</dt><dd>{sun ? sun.isAboveHorizon ? '上' : '下' : '—'}</dd></div>
        <div><dt>スマホ方位（correctedHeading）</dt><dd>{degrees(correctedHeading)}</dd></div>
        <div><dt>誤差（スマホ方位 − 太陽方位）</dt><dd>{degrees(comparison?.headingError)}</dd></div>
      </dl>
      <p className="search-status" role="status">
        {!sun ? '現在地を取得してください。'
          : !sun.isAboveHorizon ? '現在、太陽は地平線の下にあります。'
            : !comparison ? '北補正をキャリブレーションして、端末の向きを取得してください。'
              : `${comparison.assessment} / ${comparison.guidance}`}
      </p>
      <p className="search-status">誤差の目安：5°以内「かなり近い」、10°以内「概ね一致」、それ以上「ズレあり」。</p>
      <p className="debug-diagnostic-note">
        太陽を直接見ず、影などで方向を確認してください。
        誤差は方位だけの比較です。正なら左へ、負なら右へ調整します。
        既存の北補正が磁北基準の場合、真北との差も誤差に含まれます。
      </p>
      <SunPreview sun={sun} cameraForwardCorrected={cameraForwardCorrected} />
    </section>
  )
}
