import type { Matrix3 } from '../../../shared/math/types'
import { accelerationIssue, gravityAngleDegrees, gravityFromAcceleration, gravityFromCorrectedRotation } from '../gravityDiagnostics'
import type { DebugMotionState } from '../useDebugDeviceMotion'
import { diagnosticValue, eventTime } from '../formatDiagnostics'
import { VectorReadout } from './VectorReadout'

export function GravityDiagnostics({ motion, correctedRotation, manualOrientationEnabled, orientationActive, onEnable }: {
  motion: DebugMotionState
  correctedRotation: Matrix3 | null
  manualOrientationEnabled: boolean
  orientationActive: boolean
  onEnable: () => Promise<void>
}) {
  const sensor = motion.updating ? gravityFromAcceleration(motion.filteredAcceleration) : null
  const calculated = gravityFromCorrectedRotation(correctedRotation)
  function comparisonIssue(): string | null {
    if (motion.status === 'unsupported') return 'DeviceMotion未対応、またはHTTPSではありません'
    if (motion.status === 'denied') return '加速度センサーの権限拒否'
    if (motion.status === 'error') return '加速度センサーの権限取得エラー'
    if (motion.status === 'requesting') return '加速度センサーの権限確認中'
    if (!motion.updating) {
      if (motion.lastReceivedAt !== null) return '加速度センサーの更新停止（受信再開で自動復帰）'
      if (motion.status === 'idle') return 'データ未取得（加速度センサーを有効にしてください）'
      return 'データ未取得（DeviceMotionイベント未受信）'
    }
    const issue = accelerationIssue(motion.accelerationIncludingGravity) ?? accelerationIssue(motion.filteredAcceleration)
    if (issue) return issue
    if (manualOrientationEnabled) return '手動テストON（実センサー姿勢との比較にはOFFにしてください）'
    if (!orientationActive) return '姿勢センサーが更新中ではありません'
    if (!calculated) return 'correctedRotation未取得または不正（姿勢と北補正を確認してください）'
    return null
  }
  const reason = comparisonIssue()
  const angle = reason ? null : gravityAngleDegrees(sensor, calculated)
  return <section className="debug-panel" aria-labelledby="gravity-title">
    <h2 id="gravity-title">姿勢診断 / Gravity</h2>
    <button type="button" className="find-moon-button" onClick={() => { void onEnable() }}
      disabled={['unsupported', 'requesting', 'waiting', 'active', 'unavailable'].includes(motion.status)}>
      加速度センサーを有効にする（Debug専用）
    </button>
    <dl className="debug-data">
      <div><dt>DeviceMotion status</dt><dd>{motion.status}</dd></div>
      <div><dt>加速度センサー更新中</dt><dd>{String(motion.updating)}</dd></div>
      <div><dt>加速度の最終受信時刻</dt><dd>{eventTime(motion.lastReceivedAt ?? undefined)}</dd></div>
    </dl>
    <div className="debug-vector">
      <h3>accelerationIncludingGravity (m/s²・生値)</h3>
      <dl>{(['x', 'y', 'z'] as const).map(axis => <div key={axis}>
        <dt>{axis}</dt><dd>{diagnosticValue(motion.accelerationIncludingGravity?.[axis] ?? null)}</dd>
      </div>)}</dl>
    </div>
    <VectorReadout label="Gravity sensor" vector={sensor} />
    <VectorReadout label="Gravity from correctedRotation" vector={calculated} />
    <dl className="debug-data">
      <div><dt>Gravity difference (°)</dt><dd>{angle === null ? `算出不可: ${reason ?? '重力方向が不正'}` : diagnosticValue(angle)}</dd></div>
    </dl>
    <p className="search-status">どちらも端末座標の下向き単位ベクトルです。センサーは生値を0.9 / 0.1で平滑化し、正規化して符号を反転。計算側は transpose(correctedRotation) × (0, 0, −1) です。</p>
    <p className="debug-diagnostic-note">正常時とズレた時に数秒静止して、moon transformのcorrectedHeading・correctedAltitude・moonInDevice・moonScreenと角度差を比較してください。動作中はフィルタの遅れや加速度が混ざります。0°に近ければ傾きは整合していますが、重力では方位（yaw）の誤差を検出できません。角度差が小さい場合も、方位・北基準とmoonInDevice / projectionの両方を確認してください。</p>
    <p className="search-status">加速度はDebug表示専用です。本番AR・northCorrection・キャリブレーションには使用しません。</p>
  </section>
}
