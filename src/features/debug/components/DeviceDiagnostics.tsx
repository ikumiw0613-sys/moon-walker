import type { useDeviceOrientation } from '../../device-orientation/useDeviceOrientation'
import type { getMoonDeviceState } from '../../moon-guide/moonDeviceNavigation'
import type { PoseTracker } from '../../device-orientation/poseStability'
import type { ReactNode } from 'react'
import { diagnosticValue, eventTime } from '../formatDiagnostics'
import { VectorReadout } from './VectorReadout'
import { PoseStabilityDiagnostics } from './PoseStabilityDiagnostics'
import { cameraVectorToViewAngles } from '../../sky/skyParallax'

type DeviceDiagnosticsProps = {
  orientation: ReturnType<typeof useDeviceOrientation>['state']
  diagnostics: ReturnType<typeof useDeviceOrientation>['diagnostics']
  transform: ReturnType<typeof getMoonDeviceState>
  stability: PoseTracker
  manualOrientationEnabled: boolean
  screenAngle: number | undefined
  children?: ReactNode
}

export function DeviceDiagnostics({ orientation, diagnostics, transform, stability,
  manualOrientationEnabled, screenAngle, children }: DeviceDiagnosticsProps) {
  const rawEvent = diagnostics.lastAccepted
  const altitude = transform.cameraForwardCorrected ? cameraVectorToViewAngles(transform.cameraForwardCorrected).altitude : null
  return <section className="debug-panel" aria-labelledby="device-pose-title">
    <h2 id="device-pose-title"><span>D</span> Device pose</h2>
    <dl className="debug-data">
      <div><dt>correctedHeading (°)</dt><dd>{diagnosticValue(transform.correctedHeading)}</dd></div>
      <div><dt>correctedAltitude (°)</dt><dd>{diagnosticValue(altitude)}</dd></div>
      <div><dt>headingError (°)</dt><dd>{diagnosticValue(transform.headingError)}</dd></div>
      {(['alpha', 'beta', 'gamma'] as const).map(axis => <div key={axis}>
        <dt>used {axis} (°)</dt><dd>{diagnosticValue(orientation[axis])}</dd>
      </div>)}
    </dl>
    <PoseStabilityDiagnostics stability={stability} transform={transform} compact />
    {children}
    <details className="debug-details"><summary>raw sensor / cameraForward の詳細を表示</summary>
      <p className="search-status">既存フックが採用したイベントの生データ。手動入力で上書きしません。</p>
      <dl className="debug-data">
        {(['alpha', 'beta', 'gamma'] as const).map(axis => <div key={axis}>
          <dt>raw {axis} (°)</dt><dd>{diagnosticValue(rawEvent?.[axis] ?? null)}</dd>
        </div>)}
        <div><dt>absolute</dt><dd>{diagnosticValue(rawEvent?.absolute ?? null)}</dd></div>
        <div><dt>使用中のイベント種別</dt><dd>{rawEvent?.eventType ?? 'null (未受信)'}</dd></div>
        <div><dt>最終採用イベント受信時刻</dt><dd>{eventTime(rawEvent?.receivedAt)}</dd></div>
        <div><dt>最終イベント受信時刻</dt><dd>{eventTime(diagnostics.lastReceived?.receivedAt)}</dd></div>
        <div><dt>最終受信イベント種別</dt><dd>{diagnostics.lastReceived?.eventType ?? 'null (未受信)'}</dd></div>
        <div><dt>最終受信イベントの採用</dt><dd>{diagnostics.lastReceived ? diagnostics.lastReceived === rawEvent ? '採用' : '既存条件により無視' : 'null (未受信)'}</dd></div>
        <div><dt>screen.orientation.angle (°)</dt><dd>{diagnosticValue(screenAngle)}</dd></div>
      </dl>
      {manualOrientationEnabled && <p className="debug-diagnostic-note">手動テストON: cameraForwardとmoon transformは手動入力から計算しています。</p>}
      <h3 className="debug-pipeline-heading">cameraForward before correction</h3>
      <VectorReadout label="cameraForward / ENU軸表記・補正前" vector={transform.cameraForwardRaw} />
      <dl className="debug-data">
        <div><dt>azimuth (°)</dt><dd>{diagnosticValue(transform.rawView?.azimuth ?? null)}</dd></div>
        <div><dt>altitude (°)</dt><dd>{diagnosticValue(transform.rawView?.altitude ?? null)}</dd></div>
      </dl>
      <VectorReadout label="corrected cameraForward / ENU" vector={transform.cameraForwardCorrected} />
    </details>
  </section>
}
