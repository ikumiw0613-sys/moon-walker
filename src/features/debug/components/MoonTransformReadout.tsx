import type { getMoonDeviceState } from '../../moon-guide/moonDeviceNavigation'
import type { MoonPosition } from '../../moon/types'
import { diagnosticValue } from '../formatDiagnostics'
import { VectorReadout } from './VectorReadout'
import { MatrixReadout } from './MatrixReadout'
import { projectMoonToScreen } from '../../moon-guide/moonProjection'

export function MoonTransformReadout({ transform, moonPosition }: {
  transform: ReturnType<typeof getMoonDeviceState>; moonPosition: MoonPosition | null
}) {
  // Use the production AR projection, independent of the legacy 2D debug preview.
  const moonScreen = transform.moonInDevice ? projectMoonToScreen(transform.moonInDevice) : null
  const forward = transform.cameraForwardCorrected
  // Unlike heading, altitude remains defined when the camera points straight up/down.
  const correctedAltitude = forward && Object.values(forward).every(Number.isFinite)
    ? Math.asin(Math.max(-1, Math.min(1, forward.z))) * 180 / Math.PI : null
  return (
        <section className="debug-panel debug-results" aria-labelledby="results-title">
          <h2 id="results-title">moon transform</h2>
          <p className="search-status">world → transpose(correctedRotation) → device</p>
          <dl className="debug-data">
            <div><dt>moon azimuth (°)</dt><dd>{diagnosticValue(moonPosition?.azimuth ?? null)}</dd></div>
            <div><dt>moon altitude (°)</dt><dd>{diagnosticValue(moonPosition?.altitude ?? null)}</dd></div>
          </dl>
          <VectorReadout label="moonWorld / ENU" vector={transform.moonWorld} />
          <VectorReadout label="corrected cameraForward / ENU" vector={forward} />
          <dl className="debug-data">
            <div><dt>correctedHeading (°)</dt><dd>{diagnosticValue(transform.correctedHeading)}</dd></div>
            <div><dt>correctedAltitude (°)</dt><dd>{diagnosticValue(correctedAltitude)}</dd></div>
            <div><dt>headingError (°)</dt><dd>{diagnosticValue(transform.headingError)}</dd></div>
          </dl>
          <p className="search-status">cameraForward = correctedRotation × (0, 0, −1)。headingError = correctedHeading − webkitCompassHeading（最短角度差）。真上・真下ではheadingはnullです。</p>
          <VectorReadout label="moonInDevice" vector={transform.moonInDevice} />
          <p className="search-status">端末: +x 右 / +y 上 / −z 背面カメラ正面。真正面の目安は (0, 0, −1)。</p>
          <dl className="debug-data"><div><dt>moonInDeviceのベクトル長</dt><dd>{diagnosticValue(transform.moonVectorLength)}</dd></div></dl>
          <p className="search-status">太陽で確認した北補正を使う共通3D変換。{!moonPosition ? '現在地を取得してください。' : !transform.moonInDevice ? '北補正を保存し、センサーを有効にしてください。' : 'センサー値の更新に合わせて計算しています。'}</p>
          <dl className="debug-data">
            <div><dt>moonScreen.x</dt><dd>{diagnosticValue(moonScreen?.x ?? null)}</dd></div>
            <div><dt>moonScreen.y</dt><dd>{diagnosticValue(moonScreen?.y ?? null)}</dd></div>
            <div><dt>moonScreen.visible</dt><dd>{diagnosticValue(moonScreen?.visible ?? null)}</dd></div>
            <div><dt>navigation.angleToMoon (°)</dt><dd>{diagnosticValue(transform.navigation?.angleToMoon ?? null)}</dd></div>
            <div><dt>navigation.status</dt><dd>{transform.navigation?.status ?? 'null'}</dd></div>
          </dl>
          <p className="search-status">moonScreenはARと同じprojectMoonToScreenの出力（x/yは0〜1が画面内）。下の方位角・高度による2Dプレビューとは別の診断値です。背面側では既存仕様の(0.5, 0.5, false)、地平線下でも変換・投影値を表示します。</p>
          <MatrixReadout label="deviceRotation" matrix={transform.deviceRotation} />
          <MatrixReadout label="correctedRotation" matrix={transform.correctedRotation} />
          <MatrixReadout label="inverseRotation" matrix={transform.inverseRotation} />
        </section>
  )
}
