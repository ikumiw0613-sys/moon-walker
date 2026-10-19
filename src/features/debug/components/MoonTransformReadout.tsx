import { useState } from 'react'
import { diagnosticValue } from '../formatDiagnostics'
import { getMoonPipelineDiagnostics, formatMoonPipelineDiagnostics } from '../moonPipelineDiagnostics'
import type { MoonPipelineInput } from '../moonPipelineDiagnostics'
import { VectorReadout } from './VectorReadout'
import { MatrixReadout } from './MatrixReadout'
import { DirectionErrorReadout } from './DirectionErrorReadout'

function StageStatus({ reason }: { reason: string | null }) {
  return <p className={reason ? 'debug-diagnostic-note' : 'search-status'}>{reason ?? 'available'}</p>
}

export function MoonTransformReadout(input: MoonPipelineInput & { grouped?: boolean }) {
  const { transform } = input
  const data = getMoonPipelineDiagnostics(input)
  const { projection, navigation } = data
  const snapshot = formatMoonPipelineDiagnostics(data)
  const [copyStatus, setCopyStatus] = useState('')
  const [copiedSnapshot, setCopiedSnapshot] = useState<string | null>(null)

  async function copyDiagnostics() {
    // Freeze the click's values so a denied Clipboard API still has selectable text.
    setCopiedSnapshot(snapshot)
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setCopyStatus('Clipboard APIを利用できません。下のテキストを選択してコピーしてください。')
      return
    }
    try {
      await navigator.clipboard.writeText(snapshot)
      setCopyStatus('クリック時点のMoon diagnosticsをコピーしました。')
    } catch {
      setCopyStatus('コピーできませんでした。下のテキストを選択してコピーしてください。')
    }
  }

  return <section className="debug-panel debug-results" aria-labelledby="results-title">
    <h2 id="results-title">{input.grouped && <span>F</span>}Moon transform pipeline</h2>
    <p className="search-status">Moon astronomy → moonWorld → correctedRotation → moonInDevice → projection → MoonSprite</p>
    <p className="search-status">moonInDevice = transpose(correctedRotation) * moonWorld。getMoonDeviceStateが返した本番共通の値を表示しています。</p>
    <button type="button" className="find-moon-button" onClick={() => { void copyDiagnostics() }}>Moon diagnostics をコピー</button>
    {copyStatus && <p className="search-status" role="status">{copyStatus}</p>}

    <DirectionErrorReadout data={data.directionError} />
    <h3 className="debug-pipeline-heading">Astronomy</h3>
    <StageStatus reason={data.reasons.astronomy} />
    <dl className="debug-data">
      {!input.grouped && <>
      <div><dt>observationTime (UTC)</dt><dd>{data.observationTime ?? 'unavailable'}</dd></div>
      <div><dt>timeMode</dt><dd>{data.context.timeMode}</dd></div>
      <div><dt>latitude</dt><dd>{diagnosticValue(data.location?.latitude ?? null)}</dd></div>
      <div><dt>longitude</dt><dd>{diagnosticValue(data.location?.longitude ?? null)}</dd></div>
      </>}
      <div><dt>moon.azimuth (°)</dt><dd>{diagnosticValue(data.moonPosition?.azimuth ?? null)}</dd></div>
      <div><dt>moon.altitude (°)</dt><dd>{diagnosticValue(data.moonPosition?.altitude ?? null)}</dd></div>
      <div><dt>moon.isAboveHorizon</dt><dd>{diagnosticValue(data.moonPosition?.isAboveHorizon ?? null)}</dd></div>
    </dl>

    {!input.grouped && <>
    <h3 className="debug-pipeline-heading">Device / corrected view</h3>
    <StageStatus reason={data.reasons.deviceView} />
    <VectorReadout label="corrected cameraForward / ENU" vector={data.cameraForward} />
    <dl className="debug-data">
      <div><dt>orientation source / status</dt><dd>{data.context.orientationSource} / {data.context.orientationStatus}</dd></div>
      <div><dt>saved northCorrection (°)</dt><dd>{diagnosticValue(data.context.northCorrection)}</dd></div>
      <div><dt>correctedHeading (°)</dt><dd>{diagnosticValue(data.correctedHeading)}</dd></div>
      <div><dt>correctedAltitude (°)</dt><dd>{diagnosticValue(data.correctedAltitude)}</dd></div>
      <div><dt>headingError (°)</dt><dd>{diagnosticValue(transform.headingError)}</dd></div>
    </dl>
    {data.headingReason && <p className="search-status">{data.headingReason}</p>}
    <p className="search-status">correctedRotation → getCameraForward → cameraVectorToViewAngles（ARと同じ関数）。真上・真下のheadingは既存の共通判定に従いnull、altitudeは保持します。headingErrorは既存のコンパス比較値です。</p>
    </>}

    <details className="debug-details"><summary>moonWorld / moonInDevice・行列の詳細を表示</summary>
    <h3 className="debug-pipeline-heading">Moon world vector</h3>
    <StageStatus reason={data.reasons.moonWorld} />
    <VectorReadout label="moonWorld / ENU" vector={data.moonWorld} />
    <dl className="debug-data"><div><dt>moonWorld vector length</dt><dd>{diagnosticValue(data.worldLength)}</dd></div></dl>

    <h3 className="debug-pipeline-heading">Moon in device</h3>
    <StageStatus reason={data.reasons.moonInDevice} />
    <VectorReadout label="moonInDevice" vector={data.moonInDevice} />
    <dl className="debug-data"><div><dt>moonInDeviceのベクトル長</dt><dd>{diagnosticValue(data.deviceLength)}</dd></div></dl>
    <p className="search-status">端末: +x 右 / +y 上端 / −z 背面カメラ正面。正面は概ね(0, 0, −1)。</p>
    <MatrixReadout label="deviceRotation" matrix={transform.deviceRotation} />
    <MatrixReadout label="correctedRotation" matrix={transform.correctedRotation} />
    <MatrixReadout label="inverseRotation" matrix={transform.inverseRotation} />
    </details>

    <h3 className="debug-pipeline-heading">Projection</h3>
    <StageStatus reason={data.reasons.projection} />
    <dl className="debug-data">
      <div><dt>projection.depth</dt><dd>{diagnosticValue(projection.depth)}</dd></div>
      <div><dt>projection.normalizedX</dt><dd>{diagnosticValue(projection.normalizedX)}</dd></div>
      <div><dt>projection.normalizedY</dt><dd>{diagnosticValue(projection.normalizedY)}</dd></div>
      <div><dt>horizontalFov (°)</dt><dd>{diagnosticValue(projection.horizontalFov)}</dd></div>
      <div><dt>verticalFov (°)</dt><dd>{diagnosticValue(projection.verticalFov)}</dd></div>
      <div><dt>screenX / moonScreen.x</dt><dd>{diagnosticValue(projection.screen?.x ?? null)}</dd></div>
      <div><dt>screenY / moonScreen.y</dt><dd>{diagnosticValue(projection.screen?.y ?? null)}</dd></div>
      <div><dt>visible / moonScreen.visible</dt><dd>{diagnosticValue(projection.screen?.visible ?? null)}</dd></div>
    </dl>
    <details className="debug-details"><summary>投影の計算式・座標の詳細を表示</summary>
    <p className="search-status">depth = −z。normalizedX = x / (depth * tan(horizontalFov / 2))、normalizedY = y / (depth * tan(verticalFov / 2))。screenX = (normalizedX + 1) / 2、screenY = (1 − normalizedY) / 2。</p>
    <p className="search-status">最終座標は既存projectMoonToScreenの出力そのものです。normalizedX/Yはその出力から逆算する診断値（丸め誤差あり）。背面・カメラ平面では既存の早期returnによりnormalizedX/Yは未計算でnull、screenは(0.5, 0.5, false)。0〜1が画面内です。</p>
    </details>

    <h3 className="debug-pipeline-heading">Navigation</h3>
    <StageStatus reason={data.reasons.navigation} />
    <dl className="debug-data">
      <div><dt>navigation.angleToMoon (°)</dt><dd>{diagnosticValue(navigation?.angleToMoon ?? null)}</dd></div>
      <div><dt>navigation.status</dt><dd>{navigation?.status ?? 'null'}</dd></div>
      <div><dt>navigation.arrow</dt><dd>{navigation?.arrow ?? 'null'}</dd></div>
      <div><dt>navigation.message</dt><dd>{navigation?.message ?? 'null'}</dd></div>
    </dl>

    <h3 className="debug-pipeline-heading">MoonSprite</h3>
    <StageStatus reason={data.reasons.MoonSprite} />
    <details className="debug-details"><summary>MoonSprite 連携の詳細を表示</summary>
    <p className="search-status">ARは上のscreenX / screenY / visibleをMoonSpriteのx / y / visibleへ渡します。配置はleft = screenX × 100%、top = screenY × 100%、translate(−50%, −50%)。基準は.mw-ar-viewportです。visible=falseならMoonSpriteは描画しません。ARは姿勢active時のみ補正行列を使い、navigationとprojectionを必要とし、地平線下では案内とMoonSpriteを出しません。</p>
    <p className="debug-diagnostic-note">これは同じ入力を渡した場合の描画経路の説明です。実機比較は現在時刻・実機センサーを選び、観測時刻・場所・姿勢・保存済み北補正をそろえてください。下の2Dプレビューは別経路です。</p>
    </details>
    <details className="debug-pipeline-snapshot">
      <summary>Moon diagnostics テキスト（選択してコピー可能）</summary>
      {copiedSnapshot && <p className="search-status">以下はコピーボタンを押した時点の固定スナップショットです。</p>}
      <textarea aria-label="Moon diagnostics テキスト" readOnly value={copiedSnapshot ?? snapshot} rows={12} />
    </details>
  </section>
}
