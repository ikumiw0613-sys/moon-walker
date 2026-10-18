import { useReducer, useState } from 'react'
import { normalizeSignedAngle } from '../../../shared/math/angles'
import { INITIAL_SNAPSHOTS, MAX_DIAGNOSTIC_SNAPSHOTS, snapshotReducer } from '../diagnosticSnapshots'
import type { DiagnosticSnapshot } from '../diagnosticSnapshots'
import { diagnosticDegrees as degrees } from '../formatDiagnostics'

type SnapshotValues = Omit<DiagnosticSnapshot, 'timestamp' | 'memo'>
const time = (timestamp: number) => new Date(timestamp).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false })
const coordinate = (value: number | null) => value === null ? '—' : value.toFixed(5)

export function DiagnosticSnapshots({ values }: { values: SnapshotValues }) {
  const [state, dispatch] = useReducer(snapshotReducer, INITIAL_SNAPSHOTS)
  const [memo, setMemo] = useState('')
  return <section className="debug-panel" aria-labelledby="snapshots-title">
    <h2 id="snapshots-title">場所比較用スナップショット</h2>
    <p className="search-status">開けた場所・建物横・金属フェンス横で記録し、実際の月とのズレもメモしてください。移動後は現在地を再取得し、同じ向きで約3秒静止してから記録します。</p>
    <label className="debug-time-mode">場所・月とのズレのメモ（任意）
      <input value={memo} maxLength={300} placeholder="例: 金属フェンス横、月が右へ約10°" onChange={event => setMemo(event.target.value)} />
    </label>
    <div className="debug-actions">
      <button type="button" className="find-moon-button" onClick={() => {
        dispatch({ type: 'add', snapshot: { ...values, timestamp: Date.now(), memo: memo.trim() } })
        setMemo('')
      }}>現在の診断を記録</button>
      <button type="button" className="find-moon-button" disabled={!state.items.length} onClick={() => dispatch({ type: 'clear' })}>記録をすべてクリア</button>
    </div>
    <p className="search-status" role="status">{state.items.length} / {MAX_DIAGNOSTIC_SNAPSHOTS}件（一時保存・更新で消去、上限で古い順に削除）</p>
    <div className="debug-snapshots">{state.items.map(item => <article className="debug-snapshot" key={item.id} aria-label={`記録 #${item.id}`}>
      <div className="debug-snapshot-header"><h3>#{item.id} {time(item.timestamp)}（日本時間）</h3>
        <strong className={`debug-quality is-${item.quality}`}>{item.quality.toUpperCase()}</strong></div>
      {item.memo && <p className="debug-memo">{item.memo}</p>}
      <dl className="debug-data">
        <div><dt>accuracy</dt><dd>{degrees(item.compassAccuracy)}</dd></div>
        <div><dt>candidate range</dt><dd>{degrees(item.candidateRange)}</dd></div>
        <div><dt>heading range</dt><dd>{degrees(item.headingRange)}</dd></div>
      </dl>
      <details className="debug-details"><summary>記録の詳細を表示</summary>
        <dl className="debug-data">
          <div><dt>timestamp</dt><dd>{new Date(item.timestamp).toISOString()}</dd></div>
          <div><dt>緯度 / 経度</dt><dd>{coordinate(item.latitude)} / {coordinate(item.longitude)}</dd></div>
          <div><dt>位置情報の取得時刻（日本時間）</dt><dd>{item.locationTimestamp === null ? '—' : time(item.locationTimestamp)}</dd></div>
          <div><dt>orientation source / time mode</dt><dd>{item.orientationSource} / {item.timeMode}</dd></div>
          <div><dt>月の観測時刻</dt><dd>{item.observationTime ?? '—'}</dd></div>
          <div><dt>compassHeading</dt><dd>{degrees(item.compassHeading)}</dd></div>
          <div><dt>saved northCorrection</dt><dd>{degrees(item.northCorrection)}</dd></div>
          <div><dt>candidate median / samples</dt><dd>{degrees(item.candidateMedian === null ? null : normalizeSignedAngle(item.candidateMedian))} / {item.candidateCount}</dd></div>
          <div><dt>median candidate − saved</dt><dd>{degrees(item.candidateMedian === null || item.northCorrection === null ? null : normalizeSignedAngle(item.candidateMedian - item.northCorrection))}</dd></div>
          <div><dt>heading samples</dt><dd>{item.headingCount}</dd></div>
          <div><dt>gravity difference</dt><dd>{degrees(item.gravityDifference)}</dd></div>
          <div><dt>correctedHeading / correctedAltitude</dt><dd>{degrees(item.correctedHeading)} / {degrees(item.correctedAltitude)}</dd></div>
          <div><dt>moon azimuth / altitude</dt><dd>{degrees(item.moonAzimuth)} / {degrees(item.moonAltitude)}</dd></div>
        </dl>
        <ul className="debug-quality-reasons">{item.qualityReasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
      </details>
      <button type="button" className="find-moon-button" onClick={() => dispatch({ type: 'delete', id: item.id })} aria-label={`記録 #${item.id} を削除`}>削除</button>
    </article>)}</div>
  </section>
}
