import type { Matrix3 } from '../../../shared/math/types'
import { normalizeSignedAngle } from '../../../shared/math/angles'
import { CANDIDATE_HORIZONTAL_THRESHOLD, getNorthCorrectionDiagnostics } from '../../north-calibration/candidateNorthCorrection'

const angle = (value: number | null) => value === null ? 'null' : `${value.toFixed(1)}°`

export function NorthCorrectionDiagnostics({ deviceRotation, compassHeading, northCorrection }: {
  deviceRotation: Matrix3 | null
  compassHeading: number | null
  northCorrection: number | null
}) {
  const sample = getNorthCorrectionDiagnostics(deviceRotation, compassHeading)
  const difference = sample.candidateNorthCorrection !== null && northCorrection !== null
    ? normalizeSignedAngle(sample.candidateNorthCorrection - northCorrection) : null
  return <section className="debug-panel" aria-labelledby="north-candidate-title">
    <h2 id="north-candidate-title">北補正候補の比較</h2>
    <p className="search-status">実機センサーの現在値から計算します（手動テスト入力は使いません）。</p>
    <dl className="debug-data">
      <div><dt>rawHeading</dt><dd>{angle(sample.rawHeading)}</dd></div>
      <div><dt>compassHeading</dt><dd>{angle(sample.compassHeading)}</dd></div>
      <div><dt>saved northCorrection</dt><dd>{angle(northCorrection)}</dd></div>
      <div><dt>candidate northCorrection</dt><dd>{angle(sample.candidateNorthCorrection)}</dd></div>
      <div><dt>difference</dt><dd>{angle(difference)}</dd></div>
      <div><dt>cameraForward horizontalLength</dt><dd>{sample.horizontalLength?.toFixed(2) ?? 'null'}</dd></div>
      <div><dt>candidate status</dt><dd>{sample.reason ?? 'valid'}</dd></div>
    </dl>
    <p className="debug-diagnostic-note">difference = 候補 − 保存値（最短角度差）。水平成分が{CANDIDATE_HORIZONTAL_THRESHOLD}以上のときのみ有効です。候補は観察用で、保存・ARへの適用は行いません。</p>
  </section>
}
