import type { useDeviceOrientation } from '../../device-orientation/useDeviceOrientation'
import type { getMoonDeviceState } from '../../moon-guide/moonDeviceNavigation'
import { HORIZONTAL_CALIBRATION_THRESHOLD } from '../../north-calibration/horizontalCalibration'
import type { getHorizontalCalibration } from '../../north-calibration/horizontalCalibration'
import { diagnosticValue, eventTime } from '../formatDiagnostics'
import { VectorReadout } from './VectorReadout'

type DeviceDiagnosticsProps = {
  sensorOrientation: ReturnType<typeof useDeviceOrientation>['state']
  diagnostics: ReturnType<typeof useDeviceOrientation>['diagnostics']
  transform: ReturnType<typeof getMoonDeviceState>
  horizontalCalibration: ReturnType<typeof getHorizontalCalibration>
  manualOrientationEnabled: boolean
  screenAngle: number | undefined
  northCorrection: number | null
  calibrated: boolean
  calibratedAt: number | null
  onCalibrate: () => void
}

export function DeviceDiagnostics({ sensorOrientation, diagnostics, transform, horizontalCalibration,
  manualOrientationEnabled, screenAngle, northCorrection, calibrated, calibratedAt, onCalibrate }: DeviceDiagnosticsProps) {
  const rawEvent = diagnostics.lastAccepted
  return <>
        <section className="debug-panel" aria-labelledby="raw-title">
          <h2 id="raw-title">raw sensor</h2>
          <p className="search-status">既存フックが採用したイベントの生データ。手動入力で上書きしません。</p>
          <dl className="debug-data">
            <div><dt>raw alpha (°)</dt><dd>{diagnosticValue(rawEvent?.alpha ?? null)}</dd></div>
            <div><dt>raw beta (°)</dt><dd>{diagnosticValue(rawEvent?.beta ?? null)}</dd></div>
            <div><dt>raw gamma (°)</dt><dd>{diagnosticValue(rawEvent?.gamma ?? null)}</dd></div>
            <div><dt>absolute</dt><dd>{diagnosticValue(rawEvent?.absolute ?? null)}</dd></div>
            <div><dt>使用中のイベント種別</dt><dd>{rawEvent?.eventType ?? 'null (未受信)'}</dd></div>
            <div><dt>最終採用イベント受信時刻</dt><dd>{eventTime(rawEvent?.receivedAt)}</dd></div>
            <div><dt>最終イベント受信時刻</dt><dd>{eventTime(diagnostics.lastReceived?.receivedAt)}</dd></div>
            <div><dt>最終受信イベント種別</dt><dd>{diagnostics.lastReceived?.eventType ?? 'null (未受信)'}</dd></div>
            <div><dt>最終受信イベントの採用</dt><dd>{diagnostics.lastReceived ? diagnostics.lastReceived === rawEvent ? '採用' : '既存条件により無視' : 'null (未受信)'}</dd></div>
            <div><dt>screen.orientation.angle (°)</dt><dd>{diagnosticValue(screenAngle)}</dd></div>
          </dl>
          {manualOrientationEnabled && <p className="debug-diagnostic-note">手動テストON: 以下のcameraForwardとmoon transformは手動入力から計算しています。</p>}
        </section>
        <section className="debug-panel" aria-labelledby="calibration-title">
          <h2 id="calibration-title">水平キャリブレーション</h2>
          <p className="search-status">スマホを水平に近づけてください。背面カメラを地平線へ向けてください。</p>
          <p className="search-status" role="status">
            {manualOrientationEnabled ? '手動テストをOFFにしてください'
              : !horizontalCalibration.isHorizontal ? 'もう少し水平にしてください'
                : horizontalCalibration.compassHeading === null ? 'コンパス方位を取得できません'
                  : 'キャリブレーション可能'}
          </p>
          <button className="find-moon-button" type="button" disabled={!horizontalCalibration.canCalibrate}
            onClick={onCalibrate}>
            北基準を合わせる
          </button>
          <VectorReadout label="cameraForwardRaw" vector={horizontalCalibration.cameraForwardRaw} />
          <dl className="debug-data">
            <div><dt>horizontalLength</dt><dd>{diagnosticValue(horizontalCalibration.horizontalLength)}</dd></div>
            <div><dt>水平判定の閾値</dt><dd>{HORIZONTAL_CALIBRATION_THRESHOLD}</dd></div>
            <div><dt>rawHeading (°)</dt><dd>{diagnosticValue(horizontalCalibration.rawHeading)}</dd></div>
            <div><dt>webkitCompassHeading (°)</dt><dd>{diagnosticValue(horizontalCalibration.compassHeading)}</dd></div>
            <div><dt>northCorrection 候補 (°)</dt><dd>{diagnosticValue(horizontalCalibration.northCorrection)}</dd></div>
            <div><dt>northCorrection 保存値 (°)</dt><dd>{diagnosticValue(northCorrection)}</dd></div>
            <div><dt>calibrated</dt><dd>{String(calibrated)}</dd></div>
            <div><dt>calibration時刻</dt><dd>{calibratedAt !== null
              ? new Date(calibratedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : 'null'}</dd></div>
          </dl>
          <p className="debug-diagnostic-note">保存値はボタンを押した時点の補正角です。太陽・月の表示とARに共通で適用します。</p>
        </section>
        <section className="debug-panel" aria-labelledby="compass-title">
          <h2 id="compass-title">compass</h2>
          <dl className="debug-data">
            <div><dt>webkitCompassHeading (°)</dt><dd>{rawEvent ? diagnosticValue(rawEvent.webkitCompassHeading) : 'null (未受信)'}</dd></div>
            <div><dt>webkitCompassAccuracy (°)</dt><dd>{rawEvent ? diagnosticValue(rawEvent.webkitCompassAccuracy) : 'null (未受信)'}</dd></div>
            <div><dt>採用されたheading (°)</dt><dd>{diagnosticValue(sensorOrientation.compassHeading)}</dd></div>
            <div><dt>適用した北補正角 (°、世界Z軸まわりの回転)</dt><dd>{diagnosticValue(transform.correctedRotation ? northCorrection : null)}</dd></div>
            <div><dt>北補正の入力元</dt><dd>{transform.correctedRotation ? '保存済み northCorrection' : 'なし'}</dd></div>
          </dl>
          <p className="debug-diagnostic-note">コンパスは保存時の基準と誤差確認に使います。表示時は保存済みnorthCorrectionだけを適用します。</p>
          {rawEvent?.webkitCompassAccuracy !== undefined && rawEvent.webkitCompassAccuracy < 0 && (
            <p className="debug-diagnostic-note">コンパス精度が負の値です。既存の採用条件は変更せず、そのまま表示しています。</p>
          )}
        </section>
        <section className="debug-panel" aria-labelledby="before-title">
          <h2 id="before-title">cameraForward before correction</h2>
          <p className="search-status">deviceRotation × (0, 0, −1)。absolute=falseの場合は任意の基準座標で、ENUへの北合わせは未適用です。</p>
          <VectorReadout label="cameraForward / ENU軸表記・補正前" vector={transform.cameraForwardRaw} />
          <dl className="debug-data">
            <div><dt>azimuth (°)</dt><dd>{diagnosticValue(transform.rawView?.azimuth ?? null)}</dd></div>
            <div><dt>altitude (°)</dt><dd>{diagnosticValue(transform.rawView?.altitude ?? null)}</dd></div>
          </dl>
        </section>
        <section className="debug-panel" aria-labelledby="after-title">
          <h2 id="after-title">cameraForward after correction</h2>
          <p className="search-status">共通ロジックのcorrectedRotation × (0, 0, −1)。太陽プレビュー・月の変換・ARで同じ回転行列を使います。</p>
          <VectorReadout label="cameraForward / ENU・補正後" vector={transform.cameraForwardCorrected} />
          <dl className="debug-data">
            <div><dt>azimuth (°)</dt><dd>{diagnosticValue(transform.correctedView?.azimuth ?? null)}</dd></div>
            <div><dt>altitude (°)</dt><dd>{diagnosticValue(transform.correctedView?.altitude ?? null)}</dd></div>
          </dl>
          {!transform.cameraForwardCorrected && <p className="search-status">null: 向きの未取得、方位の未確定、または北基準なし。</p>}
        </section>
        <section className="debug-panel" aria-labelledby="after-calibration-title">
          <h2 id="after-calibration-title">cameraForward after calibration</h2>
          <p className="search-status">保存したnorthCorrectionで Rz(northCorrection) × deviceRotation を計算する診断表示です。</p>
          <VectorReadout label="cameraForwardCorrected / ENU" vector={transform.cameraForwardCorrected} />
          <dl className="debug-data">
            <div><dt>correctedHeading (°)</dt><dd>{diagnosticValue(transform.correctedHeading)}</dd></div>
            <div><dt>webkitCompassHeading (°)</dt><dd>{diagnosticValue(horizontalCalibration.compassHeading)}</dd></div>
            <div><dt>headingError (°)</dt><dd>{diagnosticValue(transform.headingError)}</dd></div>
          </dl>
          <p className="debug-diagnostic-note">headingError = correctedHeading − webkitCompassHeading（最短角度差）。未保存・姿勢未取得・コンパス未取得ではnullです。カメラが真上・真下の場合も方位はnullです。</p>
        </section>
  </>
}
