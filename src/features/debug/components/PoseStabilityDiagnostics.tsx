import type { PoseTracker } from '../../device-orientation/poseStability'
import type { getMoonDeviceState } from '../../moon-guide/moonDeviceNavigation'
import { diagnosticValue } from '../formatDiagnostics'

export function PoseStabilityDiagnostics({ stability, transform }: {
  stability: PoseTracker; transform: ReturnType<typeof getMoonDeviceState>
}) {
  return <section className="debug-panel" aria-labelledby="pose-stability-title">
    <h2 id="pose-stability-title">Pose stability</h2>
    <dl className="debug-data">
      <div><dt>pose stability status</dt><dd>{stability.status}</dd></div>
      <div><dt>pose stability reason</dt><dd>{stability.reason}</dd></div>
      <div><dt>correctedHeading (stability, °)</dt><dd>{diagnosticValue(transform.correctedHeading)}</dd></div>
      <div><dt>correctedAltitude (stability, °)</dt><dd>{diagnosticValue(stability.previous?.altitude ?? null)}</dd></div>
      <div><dt>heading delta (°)</dt><dd>{diagnosticValue(stability.headingDelta)}</dd></div>
      <div><dt>altitude delta (°)</dt><dd>{diagnosticValue(stability.altitudeDelta)}</dd></div>
      <div><dt>3D rotation delta (°)</dt><dd>{diagnosticValue(stability.rotationDelta)}</dd></div>
      <div><dt>orientation interval (ms)</dt><dd>{diagnosticValue(stability.intervalMs)}</dd></div>
      <div><dt>gravity difference (confidence, °)</dt><dd>{diagnosticValue(stability.gravityDifference)}</dd></div>
      <div><dt>gravity confidence reason</dt><dd>{stability.gravityReason ?? 'available'}</dd></div>
      <div><dt>recovery samples</dt><dd>{stability.recoverySamples}</dd></div>
    </dl>
    <p className="search-status">ARと同じ信頼度判定。急変・更新途切れ・継続する重力差の間は確定案内を止めます。姿勢・北補正・月の座標を作り替えません。重力は取得・符号確認済みの場合のみ補助に使い、未取得や古い値は判定から除きます。真上・真下付近ではheading差より3D回転差を使います。</p>
  </section>
}
