// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { NorthCalibrationProvider } from './NorthCalibrationProvider'
import { useNorthCalibration } from './useNorthCalibration'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it.each(['visibilitychange', 'pagehide'])('%s後は補正を無効にし、再補正で復帰する', async eventName => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  let visibility = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility as DocumentVisibilityState)
  function Probe() {
    const value = useNorthCalibration()
    return <><button onClick={() => value.saveNorthCalibration({ northCorrection: 45, calibratedAt: 100 })}>保存</button>
      <output>{JSON.stringify({ calibrated: value.calibrated, correction: value.northCorrection, needsRecalibration: value.needsRecalibration })}</output></>
  }
  const container = document.createElement('div')
  const root = createRoot(container)
  const read = () => JSON.parse(container.querySelector('output')!.textContent!)
  try {
    await act(async () => root.render(<NorthCalibrationProvider><Probe /></NorthCalibrationProvider>))
    expect(read().needsRecalibration).toBe(false)
    await act(async () => container.querySelector('button')!.click())
    expect(read().calibrated).toBe(true)
    // フォーカスの移動だけでは補正を解除しない。
    await act(async () => window.dispatchEvent(new Event('blur')))
    expect(read().calibrated).toBe(true)
    await act(async () => {
      visibility = 'hidden'
      ;(eventName === 'pagehide' ? window : document).dispatchEvent(new Event(eventName))
    })
    expect(read()).toEqual({ calibrated: false, correction: null, needsRecalibration: true })
    await act(async () => container.querySelector('button')!.click())
    expect(read().calibrated).toBe(false)
    await act(async () => {
      visibility = 'visible'
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('pageshow'))
    })
    expect(read().needsRecalibration).toBe(true)
    await act(async () => container.querySelector('button')!.click())
    expect(read()).toEqual({ calibrated: true, correction: 45, needsRecalibration: false })
  } finally {
    await act(async () => root.unmount())
  }
})
