import { useEffect, useRef, useState } from 'react'

type OrientationStatus = 'idle' | 'requesting' | 'waiting' | 'active' | 'unsupported' | 'denied' | 'unavailable' | 'error'

type OrientationState = {
  status: OrientationStatus
  alpha: number | null
  beta: number | null
  gamma: number | null
  absolute: boolean
  compassHeading: number | null
  message: string
}

type OrientationEventConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: (absolute?: boolean) => Promise<'granted' | 'denied'>
}

const NO_DATA_TIMEOUT_MS = 5000
const EMPTY_VALUES = { alpha: null, beta: null, gamma: null, absolute: false, compassHeading: null }
let permissionGranted = false

function canStartWithoutPermission(): boolean {
  return typeof window !== 'undefined' && getInitialState().status === 'idle'
    && (permissionGranted || typeof (window.DeviceOrientationEvent as OrientationEventConstructor).requestPermission !== 'function')
}

export type RawOrientationEvent = {
  alpha: number | null
  beta: number | null
  gamma: number | null
  absolute: boolean
  eventType: string
  receivedAt: number
  webkitCompassHeading: number | undefined
  webkitCompassAccuracy: number | undefined
}

function getInitialState(): OrientationState {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
    return { ...EMPTY_VALUES, status: 'unsupported', message: 'このブラウザは向きセンサーに対応していません。' }
  }
  if (!window.isSecureContext) {
    return { ...EMPTY_VALUES, status: 'unsupported', message: '向きセンサーの確認にはHTTPSで開いてください。' }
  }
  return { ...EMPTY_VALUES, status: 'idle', message: 'ボタンを押すと向きセンサーの確認を開始します。' }
}

export function useDeviceOrientation({ autoStart = false }: { autoStart?: boolean } = {}) {
  const [state, setState] = useState<OrientationState>(() => autoStart && canStartWithoutPermission()
    ? { ...EMPTY_VALUES, status: 'waiting', message: 'センサー値を待っています…' } : getInitialState())
  const [enabled, setEnabled] = useState(() => autoStart && canStartWithoutPermission())
  const [diagnostics, setDiagnostics] = useState<{
    lastReceived: RawOrientationEvent | null
    lastAccepted: RawOrientationEvent | null
  }>({ lastReceived: null, lastAccepted: null })
  const pending = useRef(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!enabled) return
    let receivedAbsolute = false

    const timeout = window.setTimeout(() => {
      setState((previous) => previous.status === 'waiting'
        ? { ...EMPTY_VALUES, status: 'unavailable', message: 'センサー値が届いていません。端末・ブラウザの対応や許可設定を確認してください。' }
        : previous)
    }, NO_DATA_TIMEOUT_MS)

    function handleOrientation(event: DeviceOrientationEvent): void {
      // 観察用メタデータ。既存のイベント採用条件やセンサー値は変更しない。
      const webkitEvent = event as DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number }
      const rawEvent: RawOrientationEvent = {
        alpha: event.alpha, beta: event.beta, gamma: event.gamma,
        absolute: event.absolute, eventType: event.type, receivedAt: Date.now(),
        webkitCompassHeading: webkitEvent.webkitCompassHeading,
        webkitCompassAccuracy: webkitEvent.webkitCompassAccuracy,
      }
      const accepted = !(event.alpha === null && event.beta === null && event.gamma === null)
        && !(receivedAbsolute && !event.absolute)
      setDiagnostics((previous) => ({
        lastReceived: rawEvent,
        lastAccepted: accepted ? rawEvent : previous.lastAccepted,
      }))
      if (event.alpha === null && event.beta === null && event.gamma === null) return
      if (receivedAbsolute && !event.absolute) return
      if (event.absolute) receivedAbsolute = true

      window.clearTimeout(timeout)
      const compass = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
      setState({
        status: 'active',
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
        absolute: event.absolute,
        compassHeading: typeof compass === 'number' && Number.isFinite(compass) && compass >= 0 ? compass : null,
        message: '取得中です。スマートフォンを傾けてみてください。',
      })
    }

    window.addEventListener('deviceorientation', handleOrientation)
    window.addEventListener('deviceorientationabsolute', handleOrientation)
    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('deviceorientation', handleOrientation)
      window.removeEventListener('deviceorientationabsolute', handleOrientation)
    }
  }, [enabled])

  async function requestPermission(): Promise<void> {
    if (pending.current || enabled) return
    const initialState = getInitialState()
    if (initialState.status === 'unsupported') {
      setState(initialState)
      return
    }

    pending.current = true
    setState({ ...EMPTY_VALUES, status: 'requesting', message: 'センサーの利用許可を確認しています。' })
    try {
      const orientationEvent = window.DeviceOrientationEvent as OrientationEventConstructor
      // iPhoneの許可要求は、ボタン操作から直接呼び出す。
      if (!permissionGranted && typeof orientationEvent.requestPermission === 'function') {
        const permission = await orientationEvent.requestPermission(true)
        if (!mounted.current) return
        if (permission !== 'granted') {
          setState({ ...EMPTY_VALUES, status: 'denied', message: '向きセンサーの利用が許可されませんでした。' })
          return
        }
        permissionGranted = true
      }
      if (!mounted.current) return
      setState({ ...EMPTY_VALUES, status: 'waiting', message: 'センサー値を待っています…' })
      setEnabled(true)
    } catch {
      if (mounted.current) {
        setState({ ...EMPTY_VALUES, status: 'error', message: 'センサーを開始できませんでした。ブラウザの許可設定を確認してください。' })
      }
    } finally {
      pending.current = false
    }
  }

  return { state, requestPermission, diagnostics }
}
