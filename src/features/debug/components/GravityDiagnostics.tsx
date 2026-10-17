import { useState } from 'react'
import type { Matrix3 } from '../../../shared/math/types'
import { accelerationIssue, gravityAngleDegrees, gravityFromAcceleration, gravityFromCorrectedRotation, normalizeGravity } from '../gravityDiagnostics'
import type { GravitySensorConvention } from '../gravityDiagnostics'
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
  // The reported target is iPhone/Safari; use its verified WebKit/Core Motion sign.
  // This state is local to the debug card, never saved with northCorrection.
  const [convention, setConvention] = useState<GravitySensorConvention>('raw-is-down')
  const rawNormalized = motion.updating ? normalizeGravity(motion.accelerationIncludingGravity) : null
  const direct = motion.updating ? gravityFromAcceleration(motion.filteredAcceleration, 'raw-is-down') : null
  const inverted = motion.updating ? gravityFromAcceleration(motion.filteredAcceleration, 'raw-is-up') : null
  const sensor = convention === 'raw-is-down' ? direct : inverted
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
  const directAngle = reason ? null : gravityAngleDegrees(direct, calculated)
  const invertedAngle = reason ? null : gravityAngleDegrees(inverted, calculated)
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
    <VectorReadout label="Normalized raw / 反転なし・フィルタ前" vector={rawNormalized} />
    <label className="debug-time-mode">
      DeviceMotion → Downの符号（Debug専用）
      <select value={convention} onChange={event => {
        if (event.target.value === 'raw-is-down' || event.target.value === 'raw-is-up') setConvention(event.target.value)
      }}>
        <option value="raw-is-down">反転なし（rawがDown / iPhone・Safari実装）</option>
        <option value="raw-is-up">反転あり（rawがUp / W3Cの例）</option>
      </select>
    </label>
    <p className="search-status">端末軸: +x=右、+y=端末上端、+z=画面手前。画面を上にして水平に置き、数秒静止して確認してください。Downは(0, 0, −1)なので、raw.zが約−9.8なら反転なし、約+9.8なら反転ありです。次に端末上端を上にして立て、Downが(0, −1, 0)になるか確認してください。行列との角度差から符号を自動選択しません。</p>
    <VectorReadout label="Gravity sensor" vector={sensor} />
    <VectorReadout label="Gravity from correctedRotation" vector={calculated} />
    <dl className="debug-data">
      <div><dt>センサーに適用する符号</dt><dd>{convention === 'raw-is-down' ? '+1（反転なし）' : '−1（反転あり）'}</dd></div>
      <div><dt>Gravity difference (°)</dt><dd>{angle === null ? `算出不可: ${reason ?? '重力方向が不正'}` : diagnosticValue(angle)}</dd></div>
      <div><dt>符号比較: 反転なし vs Down (°)</dt><dd>{directAngle === null ? `算出不可: ${reason ?? '重力方向が不正'}` : diagnosticValue(directAngle)}</dd></div>
      <div><dt>符号比較: 反転あり vs Down (°)</dt><dd>{invertedAngle === null ? `算出不可: ${reason ?? '重力方向が不正'}` : diagnosticValue(invertedAngle)}</dd></div>
    </dl>
    <p className="search-status">Gravity sensorは生値を0.9 / 0.1で平滑化・正規化し、選択した符号でDownを求めた値です。既定はiPhone / Safariの反転なし。計算側のDownは transpose(correctedRotation) × (0, 0, −1) です。符号比較の2つの角度も同じ平滑化値から計算し、フィルタ前のNormalized rawと区別します。符号は固定姿勢で確かめ、正常時とズレた時の比較中は変更しないでください。</p>
    <p className="debug-diagnostic-note">正常時とズレた時に数秒静止して、moon transformのcorrectedHeading・correctedAltitude・moonInDevice・moonScreenと角度差を比較してください。動作中はフィルタの遅れや加速度が混ざります。0°に近ければ傾きは整合していますが、重力では方位（yaw）の誤差を検出できません。角度差が小さい場合も、方位・北基準とmoonInDevice / projectionの両方を確認してください。</p>
    <p className="search-status">加速度はDebug表示専用です。本番AR・northCorrection・キャリブレーションには使用しません。</p>
  </section>
}
