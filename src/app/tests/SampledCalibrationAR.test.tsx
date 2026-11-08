// @vitest-environment jsdom
import { act, useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { NorthCalibrationProvider } from '../../features/north-calibration/NorthCalibrationProvider'
import { useNorthCalibration } from '../../features/north-calibration/useNorthCalibration'
import { ObservationTimeProvider } from '../../shared/time/ObservationTimeProvider'
import { CalibrationPage } from '../../pages/calibration/CalibrationPage'
import { ARPage } from '../../pages/ar/ARPage'
import { getMoonDeviceState } from '../../features/moon-guide/moonDeviceNavigation'

const moon = { azimuth: 90, altitude: 0, isAboveHorizon: true }
vi.mock('../../features/moon/astronomy', () => ({
  getMoonPosition: () => ({ azimuth: 90, altitude: 0, isAboveHorizon: true }),
}))
const location = { status: 'success' as const, location: { latitude: 35.68, longitude: 139.76, accuracy: 10, timestamp: 0 } }
let root: ReturnType<typeof createRoot> | undefined
afterEach(async () => {
  if (root) await act(async () => root!.unmount())
  root = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('passes only the aggregated correction into the unchanged real AR transform and projection', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-08T00:00:00Z'))
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('DeviceOrientationEvent', {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  function Flow() {
    const [page, setPage] = useState('calibration')
    const navigate = useCallback(() => setPage('ar'), [])
    const calibration = useNorthCalibration()
    return <>
      <output data-calibration>{JSON.stringify({ northCorrection: calibration.northCorrection, calibratedAt: calibration.calibratedAt })}</output>
      {page === 'calibration' ? <CalibrationPage navigate={navigate} />
        : <ARPage navigate={navigate} state={location} requestLocation={vi.fn()} />}
    </>
  }
  const container = document.createElement('div')
  root = createRoot(container)
  await act(async () => root!.render(<NorthCalibrationProvider><ObservationTimeProvider><Flow /></ObservationTimeProvider></NorthCalibrationProvider>))
  async function sensor(alpha = 315, compass = 90) {
    await act(async () => {
      vi.advanceTimersByTime(100)
      window.dispatchEvent(Object.assign(new Event('deviceorientation'), {
        alpha, beta: 90, gamma: 0, absolute: false, webkitCompassHeading: compass, webkitCompassAccuracy: 5,
      }))
    })
  }
  for (let i = 0; i < 30; i++) await sensor()
  expect(JSON.parse(container.querySelector('output')!.textContent!).northCorrection).toBeNull()
  await sensor(313) // Last candidate differs by 2 degrees; the stored median must remain -45.
  const saved = JSON.parse(container.querySelector('output')!.textContent!)
  expect(saved).toEqual({ northCorrection: -45, calibratedAt: Date.now() })
  await act(async () => vi.advanceTimersByTime(600))
  for (let i = 0; i < 6; i++) await sensor()
  const main = container.querySelector('main')!
  const expected = getMoonDeviceState({ alpha: 315, beta: 90, gamma: 0 }, -45, moon)
  expect(JSON.parse(main.dataset.correctedRotation!)).toEqual(expected.correctedRotation)
  expect(JSON.parse(main.dataset.moonInDevice!)).toEqual(expected.moonInDevice)
  expect(Number(main.dataset.correctedHeading)).toBeCloseTo(90)
  const sprite = container.querySelector<HTMLElement>('.moon-sprite')!
  expect(parseFloat(sprite.style.left)).toBeCloseTo(50)
  expect(parseFloat(sprite.style.top)).toBeCloseTo(50)
  const before = main.dataset.correctedRotation
  await sensor(315, 270)
  expect(main.dataset.correctedRotation).toBe(before)
  expect(JSON.parse(container.querySelector('output')!.textContent!)).toEqual(saved)
})
