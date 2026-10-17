import { useEffect, useRef, useState } from 'react'
import type { Vector3 } from '../../shared/math/types'
import { filterAcceleration, MOTION_STALE_TIMEOUT_MS } from './gravityDiagnostics'
import type { AccelerationSample } from './gravityDiagnostics'

type MotionStatus = 'idle' | 'requesting' | 'waiting' | 'active' | 'unsupported' | 'denied' | 'error' | 'unavailable'
export type DebugMotionState = {
  status: MotionStatus
  accelerationIncludingGravity: AccelerationSample | null
  filteredAcceleration: Vector3 | null
  lastReceivedAt: number | null
  updating: boolean
}
type MotionEventConstructor = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}
const EMPTY = { accelerationIncludingGravity: null, filteredAcceleration: null, lastReceivedAt: null, updating: false }

function initialStatus(): MotionStatus {
  return typeof window === 'undefined' || typeof window.DeviceMotionEvent === 'undefined' || !window.isSecureContext
    ? 'unsupported' : 'idle'
}

/** DebugPage only. Its samples never feed the orientation, calibration, or AR hooks. */
export function useDebugDeviceMotion() {
  const [state, setState] = useState<DebugMotionState>(() => ({ ...EMPTY, status: initialStatus() }))
  const [enabled, setEnabled] = useState(false)
  const mounted = useRef(false)
  const pending = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!enabled) return
    let filtered: Vector3 | null = null
    let lastReceived: number | null = null
    let timeout: number

    function markUnavailable() {
      filtered = null
      setState(previous => ({ ...previous, status: 'unavailable', updating: false, filteredAcceleration: null }))
    }
    function armTimeout() {
      window.clearTimeout(timeout)
      timeout = window.setTimeout(markUnavailable, MOTION_STALE_TIMEOUT_MS)
    }
    function handleMotion(event: DeviceMotionEvent) {
      const now = performance.now()
      if (lastReceived === null || now - lastReceived >= MOTION_STALE_TIMEOUT_MS) filtered = null
      lastReceived = now
      const sample = event.accelerationIncludingGravity
      const raw = sample ? { x: sample.x, y: sample.y, z: sample.z } : null
      filtered = filterAcceleration(filtered, raw)
      setState({ status: 'active', accelerationIncludingGravity: raw, filteredAcceleration: filtered,
        lastReceivedAt: Date.now(), updating: true })
      armTimeout()
    }
    function onVisibilityChange() {
      // Check freshness on resume even if background timers were throttled.
      if (document.visibilityState === 'visible'
        && (lastReceived === null || performance.now() - lastReceived >= MOTION_STALE_TIMEOUT_MS)) markUnavailable()
    }
    armTimeout()
    window.addEventListener('devicemotion', handleMotion)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('devicemotion', handleMotion)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled])

  async function requestPermission(): Promise<void> {
    if (pending.current || enabled) return
    if (initialStatus() === 'unsupported') {
      setState({ ...EMPTY, status: 'unsupported' })
      return
    }
    pending.current = true
    setState({ ...EMPTY, status: 'requesting' })
    try {
      const constructor = window.DeviceMotionEvent as MotionEventConstructor
      // Invoke directly from the diagnostic button's user gesture (iOS).
      const permission = typeof constructor.requestPermission === 'function'
        ? await constructor.requestPermission() : 'granted'
      if (!mounted.current) return
      if (permission !== 'granted') {
        setState({ ...EMPTY, status: 'denied' })
        return
      }
      setState({ ...EMPTY, status: 'waiting' })
      setEnabled(true)
    } catch {
      if (mounted.current) setState({ ...EMPTY, status: 'error' })
    } finally {
      pending.current = false
    }
  }

  return { state, requestPermission }
}
