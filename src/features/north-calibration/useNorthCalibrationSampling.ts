import { useCallback, useEffect, useRef, useState } from 'react'
import type { RawOrientationEvent } from '../device-orientation/useDeviceOrientation'
import type { NorthCalibration } from './horizontalCalibration'
import { CALIBRATION_SAMPLING_LIMITS, collectCalibrationEvent, createCalibrationCollection } from './calibrationSampling'

function screenAngle(): number | null {
  const angle = window.screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation
  return typeof angle === 'number' && Number.isFinite(angle) ? angle : null
}

/** Collection belongs to the calibration screen; the saved AR correction remains fixed. */
export function useNorthCalibrationSampling(event: RawOrientationEvent | null, active: boolean,
  saveNorthCalibration: (calibration: NorthCalibration) => void) {
  const collection = useRef(createCalibrationCollection(0))
  const wasActive = useRef(false)
  const [measurement, setMeasurement] = useState(() => createCalibrationCollection(0))
  const reset = useCallback((message: string, phase: 'settling' | 'waiting' = 'settling') => {
    const next = { ...createCalibrationCollection(Date.now(), message), phase }
    collection.current = next
    setMeasurement(next)
  }, [])
  const isCurrentCompletion = useCallback(() => collection.current.phase === 'complete', [])
  const restart = useCallback(() => reset('向きを保ってください。測定の準備をしています。'), [reset])

  useEffect(() => {
    const onVisibility = () => reset(document.visibilityState === 'hidden'
      ? '測定を中断しました。画面に戻ると測り直します。'
      : '画面に戻りました。向きを保って、もう一度測定します。')
    const onOrientation = () => reset('画面の向きが変わりました。向きを保って、もう一度測定します。')
    const onPage = () => reset('向きを保ってください。もう一度測定します。')
    const orientation = window.screen.orientation
    reset('向きを保ってください。測定の準備をしています。')
    document.addEventListener('visibilitychange', onVisibility)
    orientation?.addEventListener('change', onOrientation)
    window.addEventListener('orientationchange', onOrientation)
    window.addEventListener('pagehide', onPage)
    window.addEventListener('pageshow', onPage)
    const timer = window.setInterval(() => {
      const current = collection.current
      if (current.phase !== 'complete' && current.lastEventAt !== null
        && Date.now() - current.lastEventAt > CALIBRATION_SAMPLING_LIMITS.maximumGapMs) {
        reset('新しいセンサー値を待っています。向きを保ってください。')
      }
    }, 200)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      orientation?.removeEventListener('change', onOrientation)
      window.removeEventListener('orientationchange', onOrientation)
      window.removeEventListener('pagehide', onPage)
      window.removeEventListener('pageshow', onPage)
      window.clearInterval(timer)
    }
  }, [reset])

  const eventKey = event ? [event.sequence, event.receivedAt, event.eventType, event.absolute,
    event.alpha, event.beta, event.gamma, event.webkitCompassHeading, event.webkitCompassAccuracy].join('|') : null
  useEffect(() => {
    if (!active || document.visibilityState === 'hidden') {
      if (wasActive.current || collection.current.phase !== 'waiting') reset('向きセンサーの測定を待っています。', 'waiting')
      wasActive.current = false
      return
    }
    if (!wasActive.current) {
      wasActive.current = true
      reset('向きを保ってください。測定の準備をしています。')
      return
    }
    if (!event) return
    const previous = collection.current
    const next = collectCalibrationEvent(previous, event, Date.now(), screenAngle())
    collection.current = next
    if (next.phase !== previous.phase || next.message !== previous.message
      || next.progress !== previous.progress || next.northCorrection !== previous.northCorrection) setMeasurement(next)
    if (next.phase === 'complete' && previous.phase !== 'complete' && next.northCorrection !== null) {
      // Persist only the aggregated angle and existing capture timestamp, never samples.
      saveNorthCalibration({ northCorrection: next.northCorrection, calibratedAt: Date.now() })
    }
    // Acquisition identity, not renders or clock ticks, contributes a sample.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [eventKey, active, reset, saveNorthCalibration])

  return { measurement, isCurrentCompletion, restart }
}
