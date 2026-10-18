import { useRef, useState } from 'react'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { MoonPhaseInfo, MoonPosition } from '../../../features/moon/types'
import type { getMoonDeviceState } from '../../../features/moon-guide/moonDeviceNavigation'
import { compareProjections, FOV_MISMATCH_WARNING_PERCENT, fovConsistency, projectWithDiagnosticFov, selectDiagnosticFov, viewportToWindow } from '../../../features/debug/arProjectionDiagnostics'
import type { FovMode, Placement, ProjectionPoint } from '../../../features/debug/arProjectionDiagnostics'
import { useARProjectionMeasurements } from '../../../features/debug/useARProjectionMeasurements'
import { MoonSprite } from './MoonSprite'
import './ARProjectionExperiment.css'

const number = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits)
const pair = (x: number | null | undefined, y: number | null | undefined) => `${number(x)} / ${number(y)}`
const rectText = (rect: { left: number; top: number; width: number; height: number } | null | undefined) => rect
  ? `${number(rect.left)}, ${number(rect.top)} / ${number(rect.width)} × ${number(rect.height)}` : '—'
const vectorText = (vector: { x: number; y: number; z: number } | null) => vector
  ? `${number(vector.x)} / ${number(vector.y)} / ${number(vector.z)}` : '—'

export function ARProjectionExperiment({ viewportRef, screen, moonPosition, deviceState, phase, canRender, now,
  timeMode, orientationStatus, poseStatus, initialPlacement }: {
  viewportRef: RefObject<HTMLDivElement | null>
  screen: ProjectionPoint | null
  moonPosition: MoonPosition | null
  deviceState: ReturnType<typeof getMoonDeviceState>
  phase: MoonPhaseInfo
  canRender: boolean
  now: Date
  timeMode: string
  orientationStatus: string
  poseStatus: string
  initialPlacement: Placement
}) {
  const spriteRef = useRef<HTMLDivElement | null>(null)
  const [placement, setPlacement] = useState<Placement>(initialPlacement)
  const [fovMode, setFovMode] = useState<FovMode>('production')
  const [markers, setMarkers] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement | null>(null)
  const measurement = useARProjectionMeasurements(viewportRef, spriteRef,
    `${screen?.x}|${screen?.y}|${screen?.visible}|${canRender}|${placement}`)
  const comparison = compareProjections(moonPosition, deviceState.correctedView, deviceState.moonInDevice)
  const productionFov = { horizontal: comparison.production.horizontalFov, vertical: comparison.production.verticalFov }
  const consistency = fovConsistency(measurement?.viewport ?? null, productionFov)
  const fov = selectDiagnosticFov(fovMode, measurement?.window ?? null, measurement?.viewport ?? null)
  const trial = projectWithDiagnosticFov(deviceState.moonInDevice, fov)
  const fullRect = measurement ? { left: 0, top: 0, ...measurement.window } : null
  const placedRect = placement === 'full-screen' ? fullRect : measurement?.viewport ?? null
  const windowPosition = viewportToWindow(screen, measurement?.viewport ?? null, measurement?.window ?? null)
  const fullPosition = viewportToWindow(screen, fullRect, measurement?.window ?? null)
  const expected = placement === 'full-screen' ? fullPosition : windowPosition
  const actual = measurement?.spriteCenter
  const actualDelta = actual && expected ? { x: actual.x - expected.windowX, y: actual.y - expected.windowY } : null
  const twoDPoint = comparison.twoD ? { x: comparison.twoD.x / 100, y: comparison.twoD.y / 100, visible: comparison.twoD.isVisible } : null
  const twoDPosition = viewportToWindow(twoDPoint, placedRect, measurement?.window ?? null)
  const trialPosition = viewportToWindow(trial, placedRect, measurement?.window ?? null)
  const trialConsistency = fov ? fovConsistency(placedRect, fov) : null
  const snapshot = { observationTime: now.toISOString(), timeMode, orientationStatus, poseStatus, canRender, placement,
    screen, moonPosition, moonWorld: deviceState.moonWorld, moonInDevice: deviceState.moonInDevice,
    correctedRotation: deviceState.correctedRotation, correctedView: deviceState.correctedView, comparison, measurement,
    windowPosition, fullPosition, actualDelta, consistency, fovMode, trialFov: fov, trial, trialConsistency }

  const panel = <aside className="ar-projection-diagnostic" aria-label="AR projection diagnostics"
    data-ar-projection-diagnostics={JSON.stringify(snapshot)} onKeyDown={event => {
      if (event.key === 'Escape' && panelOpen) {
        setPanelOpen(false)
        toggleRef.current?.focus()
      }
    }}>
    <button ref={toggleRef} type="button" className="ar-projection-toggle" aria-expanded={panelOpen}
      aria-controls="ar-projection-panel" onClick={() => setPanelOpen(open => !open)}>
      {panelOpen ? '診断を閉じる' : '投影診断を開く'}
    </button>
    <div id="ar-projection-panel" className="ar-projection-panel" hidden={!panelOpen}>
      <h2>AR 投影診断（比較専用）</h2>
      <p>センサー・北補正は共通。月本体は本番90° / 60°のまま、配置基準だけ切り替えます。リング・画面端マーカーは従来のviewport基準です。</p>
      <label>月本体の配置基準<select value={placement} onChange={event => setPlacement(event.target.value as Placement)}>
        <option value="viewport">viewport projection</option><option value="full-screen">full-screen projection</option>
      </select></label>
      <label>仮FOV（シアンの比較点のみ）<select value={fovMode} onChange={event => setFovMode(event.target.value as FovMode)}>
        <option value="production">本番 90 / 60</option><option value="square">90 / 90</option>
        <option value="window-h">window比率・水平90を維持</option>
        <option value="viewport-h">viewport比率・水平90を維持</option>
        <option value="viewport-v">viewport比率・垂直60を維持</option>
      </select></label>
      <label><input type="checkbox" checked={markers} onChange={event => setMarkers(event.target.checked)} />比較点を表示（橙: 2D / シアン: 仮FOV 3D）</label>
      <p>{now.toISOString()} / {timeMode} / orientation: {orientationStatus} / pose: {poseStatus}</p>
      {!canRender && <p className="ar-projection-warning">本番の表示条件を満たしていません。月・比較点は非表示。数値は診断用です。</p>}
      {timeMode === 'fixed' && <p className="ar-projection-warning">固定日時ラベルがmainのgrid itemとして追加されています。3行定義への自動配置でviewportの割当行が変わるため、CSS詳細の各行の実測サイズも確認してください。</p>}
      {measurement?.viewport && (measurement.viewport.width === 0 || measurement.viewport.height === 0) && <p className="ar-projection-warning">viewportの幅または高さが0です。absolute配置の月が同じ線上へ潰れるため、gridの行割当・サイズを確認してください。</p>}
      <dl>
        <div><dt>window.innerWidth / innerHeight</dt><dd>{pair(measurement?.window.width, measurement?.window.height)} px</dd></div>
        <div><dt>viewport rect: left, top / width × height</dt><dd>{rectText(measurement?.viewport)}</dd></div>
        <div><dt>MoonSprite 実測rect</dt><dd>{rectText(measurement?.sprite)}</dd></div>
        <div><dt>本番 screenX / screenY（0〜1）</dt><dd>{pair(screen?.x, screen?.y)}</dd></div>
        <div><dt>viewport基準 windowX / windowY</dt><dd>{pair(windowPosition?.windowX, windowPosition?.windowY)} px</dd></div>
        <div><dt>normalizedWindowX / normalizedWindowY</dt><dd>{pair(windowPosition?.normalizedWindowX, windowPosition?.normalizedWindowY)}</dd></div>
        <div><dt>full-screen基準 windowX / windowY</dt><dd>{pair(fullPosition?.windowX, fullPosition?.windowY)} px</dd></div>
        <div><dt>full-screen − viewport</dt><dd>{windowPosition && fullPosition ? pair(fullPosition.windowX - windowPosition.windowX, fullPosition.windowY - windowPosition.windowY) : '—'} px</dd></div>
        <div><dt>MoonSprite 実測中心（window）</dt><dd>{pair(actual?.x, actual?.y)} px</dd></div>
        <div><dt>実測中心 − 選択配置の計算値</dt><dd>{pair(actualDelta?.x, actualDelta?.y)} px</dd></div>
      </dl>
      {actualDelta && Math.hypot(actualDelta.x, actualDelta.y) > 2 && <p className="ar-projection-warning">CSS実測とrect式に差があります。border / transform / containing block / スクロールを確認してください。</p>}
      <details><summary>同一入力の2D / 3D比較</summary>
        <div className="ar-projection-columns"><section><h3>A. Debug 2D</h3><dl>
          <div><dt>azimuth / altitude 差</dt><dd>{pair(comparison.azimuthDifference, comparison.altitudeDifference)}°</dd></div>
          <div><dt>x / y（%）</dt><dd>{pair(comparison.twoD?.x, comparison.twoD?.y)}</dd></div>
          <div><dt>visible</dt><dd>{comparison.twoD ? String(comparison.twoD.isVisible) : '—'}</dd></div>
        </dl></section><section><h3>B. AR 3D（本番）</h3><dl>
          <div><dt>moonInDevice</dt><dd>{vectorText(deviceState.moonInDevice)}</dd></div>
          <div><dt>normalizedX / normalizedY</dt><dd>{pair(comparison.production.normalizedX, comparison.production.normalizedY)}</dd></div>
          <div><dt>screenX / screenY（0〜1）</dt><dd>{pair(comparison.production.screen?.x, comparison.production.screen?.y)}</dd></div>
          <div><dt>visible / reason</dt><dd>{String(comparison.production.screen?.visible ?? '—')} / {comparison.production.reason ?? 'available'}</dd></div>
        </dl></section></div>
        <dl><div><dt>3D − 2D: x差 / y差（画面幅・高さの%）</dt><dd>{pair(comparison.deltaX === null ? null : comparison.deltaX * 100, comparison.deltaY === null ? null : comparison.deltaY * 100)}</dd></div></dl>
        <p>両者を0〜1へ揃えて比較しています。2Dは角度の線形写像、3Dは透視投影でrollも反映します。差があるだけではバグとは断定できません。</p>
      </details>
      <details><summary>FOV / aspect ratio</summary><dl>
        <div><dt>viewport aspect ratio</dt><dd>{number(consistency?.aspect, 4)}</dd></div>
        <div><dt>current horizontal / vertical FOV</dt><dd>{pair(productionFov.horizontal, productionFov.vertical)}°</dd></div>
        <div><dt>FOVが期待するaspect ratio</dt><dd>{number(consistency?.expectedAspect, 4)}</dd></div>
        <div><dt>mismatch = (実aspect / 期待aspect − 1) ×100</dt><dd>{number(consistency?.mismatchPercent)}%</dd></div>
        <div><dt>仮 horizontal / vertical FOV</dt><dd>{pair(fov?.horizontal, fov?.vertical)}°</dd></div>
        <div><dt>仮FOVと選択配置領域のmismatch</dt><dd>{number(trialConsistency?.mismatchPercent)}%</dd></div>
        <div><dt>仮FOV screenX / screenY</dt><dd>{pair(trial?.x, trial?.y)}</dd></div>
      </dl><p>tan(hFov/2) = aspect × tan(vFov/2)。比率の一致だけで実際の視野角が正しいことは証明できません。</p></details>
      {consistency?.warning && <p className="ar-projection-warning">固定90° / 60°とviewport比率に{FOV_MISMATCH_WARNING_PERCENT}%超の差があります。縦横の角度スケールが同一焦点距離の透視投影と整合していません。</p>}
      {(measurement?.fixedContainingBlocks.length ?? 0) > 0 && <p className="ar-projection-warning">fixedの基準を変える祖先: {measurement!.fixedContainingBlocks.join(', ')}</p>}
      {measurement?.visualViewport && measurement.visualViewport.scale !== 1 && <p className="ar-projection-warning">ページがズームされています。innerWidth/HeightとvisualViewportを区別して比較してください。</p>}
      <details><summary>CSS / safe-area / positioning context</summary>
        <p>実際の祖先だけを検査します。paddingはsafe-area反映後のcomputed値。sprite transformのtranslate(-50%, -50%)は左上指定を中心指定へ合わせます。full-screenの月はbodyへportalし、アプリ祖先のtransformを避けます。</p>
        <pre>{JSON.stringify({ spriteStyle: measurement?.spriteStyle, offsetParent: measurement?.offsetParent,
          ancestors: measurement?.ancestors, gridChildren: measurement?.gridChildren, fixedContainingBlocks: measurement?.fixedContainingBlocks,
          visualViewport: measurement?.visualViewport }, null, 2)}</pre>
      </details>
      <details><summary>クリック時点の診断を記録・選択コピー</summary>
        <button type="button" onClick={() => setCopied(JSON.stringify(snapshot, null, 2))}>診断テキストを固定</button>
        <textarea aria-label="AR projection 診断テキスト" readOnly rows={10} value={copied ?? JSON.stringify(snapshot, null, 2)} />
      </details>
    </div>
  </aside>

  return <>
    {canRender && screen && <MoonSprite x={screen.x} y={screen.y} visible={screen.visible} phase={phase}
      diagnosticRef={spriteRef} diagnosticWindow={placement === 'full-screen' ? measurement?.window : null} />}
    {createPortal(<>
      {markers && canRender && twoDPoint?.visible && twoDPosition && <div className="ar-projection-point is-2d" style={{ left: twoDPosition.windowX, top: twoDPosition.windowY }}>＋<span>2D</span></div>}
      {markers && canRender && trial?.visible && trialPosition && <div className="ar-projection-point is-trial" style={{ left: trialPosition.windowX, top: trialPosition.windowY }}>＋<span>3D 仮FOV</span></div>}
      {panel}
    </>, document.body)}
  </>
}
