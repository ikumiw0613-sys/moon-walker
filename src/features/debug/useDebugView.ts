import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { LocationState } from '../geolocation/types'
import type { MoonPosition } from '../moon/types'

const DEGREES_PER_PIXEL = 0.2

export function useDebugView({ state, timeMode, moonPosition }: {
  state: LocationState; timeMode: 'fixed' | 'current'; moonPosition: MoonPosition | null
}) {
  const [viewAzimuth, setViewAzimuth] = useState(0)
  const [viewAltitude, setViewAltitude] = useState(0)
  const [sensorMode, setSensorMode] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragPosition = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const [assistedInput, setAssistedInput] = useState<{ state: LocationState; timeMode: typeof timeMode } | null>(null)
  // 位置取得・時刻モード変更時だけ視点を合わせ、自動更新中のドラッグは維持する。
  if (moonPosition && (state !== assistedInput?.state || timeMode !== assistedInput?.timeMode)) {
    setAssistedInput({ state, timeMode })
    setViewAzimuth(moonPosition.azimuth)
    setViewAltitude(moonPosition.altitude)
  }

  function faceMoon(): void {
    if (!moonPosition) return

    setSensorMode(false)
    setViewAzimuth(moonPosition.azimuth)
    setViewAltitude(moonPosition.altitude)
  }

  function moveView(azimuthDelta: number, altitudeDelta: number): void {
    setViewAzimuth((azimuth) => ((azimuth + azimuthDelta) % 360 + 360) % 360)
    setViewAltitude((altitude) => Math.max(-90, Math.min(90, altitude + altitudeDelta)))
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>): void {
    if (sensorMode) return
    if (event.pointerType !== 'mouse' || event.button !== 0 || dragPosition.current) return
    if (event.target instanceof Element && event.target.closest('button, summary, a, input, select, textarea')) return

    event.currentTarget.setPointerCapture(event.pointerId)
    dragPosition.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    setIsDragging(true)
    event.preventDefault()
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>): void {
    const previous = dragPosition.current
    if (!previous || previous.pointerId !== event.pointerId) return

    const deltaX = event.clientX - previous.x
    const deltaY = event.clientY - previous.y
    dragPosition.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    moveView(deltaX * DEGREES_PER_PIXEL, -deltaY * DEGREES_PER_PIXEL)
  }

  function handlePointerEnd(event: PointerEvent<HTMLElement>): void {
    if (dragPosition.current?.pointerId !== event.pointerId) return

    dragPosition.current = null
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return { viewAzimuth, viewAltitude, sensorMode, setSensorMode, isDragging, faceMoon, handlePointerDown, handlePointerMove, handlePointerEnd }
}
