import { normalizeSignedAngle } from '../../../shared/math/angles'
import { COMPASS_MIN_SAMPLES, COMPASS_QUALITY_LIMITS } from '../compassDiagnostics'
import type { Statistics } from '../compassDiagnostics'
import type { useCompassDiagnostics } from '../useCompassDiagnostics'
import { diagnosticValue, diagnosticDegrees as degrees } from '../formatDiagnostics'

function AngularReadout({ label, stats, signed = false }: { label: string; stats: Statistics | null; signed?: boolean }) {
  const angle = (value: number | undefined) => degrees(value === undefined ? null : signed ? normalizeSignedAngle(value) : value)
  return <div>
    <h3>{label}</h3>
    <dl className="debug-data">
      <div><dt>sample count</dt><dd>{stats?.count ?? 0}</dd></div>
      <div><dt>median</dt><dd>{angle(stats?.median)}</dd></div>
      <div><dt>min / max（円周上の端点）</dt><dd>{angle(stats?.min)} / {angle(stats?.max)}</dd></div>
      <div><dt>angular range</dt><dd>{degrees(stats?.range)}</dd></div>
      <div><dt>deviation（標準偏差相当）</dt><dd>{degrees(stats?.deviation)}</dd></div>
    </dl>
  </div>
}

export function CompassStabilityDiagnostics({ diagnostic, northCorrection, rawAccuracy }: {
  diagnostic: ReturnType<typeof useCompassDiagnostics>; northCorrection: number | null; rawAccuracy: number | null | undefined
}) {
  const { stats, current, quality } = diagnostic
  const difference = stats.candidate && northCorrection !== null
    ? normalizeSignedAngle(stats.candidate.median - northCorrection) : null
  const limits = COMPASS_QUALITY_LIMITS
  return <section className="debug-panel" aria-labelledby="compass-stability-title">
    <h2 id="compass-stability-title"><span>C</span> Compass stability / 磁気環境診断</h2>
    <p className="search-status">ここでは時間変動と端末報告のaccuracyを確認します。既知の対象への絶対方位誤差はLandmark compass validationで確認してください。</p>
    <p>Compass Quality: <strong className={`debug-quality is-${quality.status}`}>{quality.status.toUpperCase()}</strong></p>
    <ul className="debug-quality-reasons">{quality.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
    <p className="search-status">端末を同じ向きで数秒静止させて比較してください。端末の回転も heading range に含まれます。GOOD は磁北・真北の一致や磁気干渉がないことの保証ではありません。</p>
    <h3 className="debug-pipeline-heading">webkitCompassAccuracy</h3>
    <dl className="debug-data">
      <div><dt>webkitCompassAccuracy (°)</dt><dd>{rawAccuracy === null ? 'null (未受信)' : diagnosticValue(rawAccuracy)}</dd></div>
      {!current && <div><dt>current の有効性</dt><dd>現在値は判定対象外</dd></div>}
      <div><dt>median / samples</dt><dd>{degrees(stats.accuracy?.median)} / {stats.accuracy?.count ?? 0}</dd></div>
      <div><dt>min / max</dt><dd>{degrees(stats.accuracy?.min)} / {degrees(stats.accuracy?.max)}</dd></div>
    </dl>
    {rawAccuracy !== undefined && rawAccuracy !== null && rawAccuracy < 0 && <p className="debug-diagnostic-note">コンパス精度が負の値です。生値を残し、品質判定からは除外します。</p>}
    <div className="debug-statistics">
      <AngularReadout label="North correction candidate" stats={stats.candidate} signed />
      <AngularReadout label="Compass heading stability" stats={stats.heading} />
    </div>
    <dl className="debug-data"><div><dt>median candidate − saved（最短角度差）</dt><dd>{degrees(difference)}</dd></div></dl>
    <details className="debug-details"><summary>集計・品質判定の詳細を表示</summary>
      <p className="search-status">直近3秒、最大30件。採用イベントを最大10Hzで記録し、1秒以上更新が途切れると判定を停止します。各項目{COMPASS_MIN_SAMPLES}件未満・欠測・負のaccuracy・手動入力はUNAVAILABLE。</p>
      <p className="search-status">GOOD: accuracy ≤ {limits.goodAccuracy}°、candidate / heading range ≤ {limits.goodRange}°。POOR: accuracy &gt; {limits.poorAccuracy}°、またはいずれかのrange &gt; {limits.poorRange}°。その他はCAUTION。accuracyは現在値と直近中央値の悪い方を使用します。</p>
      <p className="search-status">角度は円周上の最短包含区間を基準に展開して集計します。min / max はこの区間の端点で、359° → 1° のrangeは2°です。判定はDebug専用で、キャリブレーション確定条件には適用しません。</p>
    </details>
  </section>
}
