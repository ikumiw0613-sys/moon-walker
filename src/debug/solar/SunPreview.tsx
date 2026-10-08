import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { convertMoonToScreen } from '../../lib/coordinates'
import { normalizeAzimuth } from '../../lib/deviceView'
import { getCameraView } from '../../lib/northReferencedDevice'
import { getMoonNavigation } from '../../lib/moonNavigation'
import type { Vector3 } from '../../types/vector3'
import type { SunPosition } from './sunPosition'

export function SunPreview({ sun, cameraForwardCorrected }: { sun: SunPosition | null; cameraForwardCorrected: Vector3 | null }) {
  const [useSensor, setUseSensor] = useState(true)
  const [manualView, setManualView] = useState({ azimuth: 0, altitude: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const sensorView = getCameraView(cameraForwardCorrected)
  const view = useSensor ? sensorView : manualView
  const position = sun && view ? convertMoonToScreen(sun.azimuth, sun.altitude, view.azimuth, view.altitude) : null
  const navigation = sun && view ? getMoonNavigation(sun, view).message.replaceAll('月', '太陽') : null

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (useSensor || event.pointerType !== 'mouse' || event.button !== 0 || drag.current) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    setIsDragging(true)
    event.preventDefault()
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const previous = drag.current
    if (!previous || previous.id !== event.pointerId) return
    const dx = (event.clientX - previous.x) * 0.2
    const dy = (event.clientY - previous.y) * 0.2
    setManualView((current) => ({ azimuth: normalizeAzimuth(current.azimuth + dx), altitude: Math.max(-90, Math.min(90, current.altitude - dy)) }))
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return
    drag.current = null
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <section aria-labelledby="sun-preview-title">
      <h3 id="sun-preview-title">太陽の画面投影プレビュー</h3>
      <button className="find-moon-button" type="button" disabled={!sun} onClick={() => {
        if (sun) { setUseSensor(false); setManualView({ azimuth: sun.azimuth, altitude: sun.altitude }) }
      }}>太陽を正面にする（仮想視点）</button>
      <button className="find-moon-button" type="button" onClick={() => setUseSensor(!useSensor)}>
        {useSensor ? 'マウス操作に切り替える' : '補正済みセンサーで操作する'}
      </button>
      <p className="search-status">
        {useSensor ? '北補正済みの端末方向に連動します。' : 'マウスドラッグで仮想視点を動かせます。'}
        既存と同じ2Dの角度差による投影です。
      </p>
      <dl className="debug-data debug-preview-data">
        <div><dt>視点の方位 / 高度</dt><dd>{view ? `${view.azimuth.toFixed(1)}° / ${view.altitude.toFixed(1)}°` : '—'}</dd></div>
        <div><dt>画面 x / y</dt><dd>{position ? `${position.x.toFixed(1)}% / ${position.y.toFixed(1)}%` : '—'}</dd></div>
      </dl>
      <div className={`debug-preview${isDragging ? ' is-dragging' : ''}`}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onLostPointerCapture={onPointerEnd}>
        <div className="debug-crosshair" aria-hidden="true" />
        <span className="debug-preview-label">SUN VIEWPORT</span>
        {sun?.isAboveHorizon && position?.isVisible && (
          <div className="moon-marker" aria-label="太陽" style={{ left: `${position.x}%`, top: `${position.y}%` }}>☀️</div>
        )}
        <p className="debug-preview-navigation" role="status">
          {!sun ? '現在地の取得待ち'
            : !sun.isAboveHorizon ? '現在、太陽は地平線の下にあります'
              : !view ? '北補正・センサーの取得待ち（真上・真下では方位未確定）'
                : navigation}
        </p>
      </div>
    </section>
  )
}
