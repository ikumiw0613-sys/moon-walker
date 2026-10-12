import type { getMoonDeviceState } from '../../moon-guide/moonDeviceNavigation'
import type { MoonPosition } from '../../moon/types'
import { diagnosticValue } from '../formatDiagnostics'
import { VectorReadout } from './VectorReadout'
import { MatrixReadout } from './MatrixReadout'

export function MoonTransformReadout({ transform, moonPosition }: {
  transform: ReturnType<typeof getMoonDeviceState>; moonPosition: MoonPosition | null
}) {
  return (
        <section className="debug-panel debug-results" aria-labelledby="results-title">
          <h2 id="results-title">moon transform</h2>
          <p className="search-status">world → transpose(correctedRotation) → device</p>
          <VectorReadout label="moonWorld / ENU" vector={transform.moonWorld} />
          <VectorReadout label="moonInDevice" vector={transform.moonInDevice} />
          <p className="search-status">端末: +x 右 / +y 上 / −z 背面カメラ正面。真正面の目安は (0, 0, −1)。</p>
          <dl className="debug-data"><div><dt>moonInDeviceのベクトル長</dt><dd>{diagnosticValue(transform.moonVectorLength)}</dd></div></dl>
          <p className="search-status">太陽で確認した北補正を使う共通3D変換。{!moonPosition ? '現在地を取得してください。' : !transform.moonInDevice ? '北補正を保存し、センサーを有効にしてください。' : 'センサー値の更新に合わせて計算しています。'}</p>
          <dl className="debug-data"><div><dt>angleToMoon (°)</dt><dd>{diagnosticValue(transform.angleToMoon)}</dd></div></dl>
          <MatrixReadout label="deviceRotation" matrix={transform.deviceRotation} />
          <MatrixReadout label="correctedRotation" matrix={transform.correctedRotation} />
          <MatrixReadout label="inverseRotation" matrix={transform.inverseRotation} />
        </section>
  )
}
