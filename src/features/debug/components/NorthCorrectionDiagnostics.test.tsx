import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { deviceOrientationToMatrix } from '../../device-orientation/deviceRotation'
import { NorthCorrectionDiagnostics } from './NorthCorrectionDiagnostics'

it('shows the candidate, saved value and signed candidate minus saved difference', () => {
  const html = renderToStaticMarkup(<NorthCorrectionDiagnostics
    deviceRotation={deviceOrientationToMatrix(-92.4, 90, 0)} compassHeading={101.1} northCorrection={-8.2} />)
  for (const value of ['rawHeading</dt><dd>92.4°', 'compassHeading</dt><dd>101.1°',
    'saved northCorrection</dt><dd>-8.2°', 'candidate northCorrection</dt><dd>-8.7°',
    'difference</dt><dd>-0.5°', 'cameraForward horizontalLength</dt><dd>1.00', 'candidate status</dt><dd>valid']) {
    expect(html).toContain(value)
  }
})

it('wraps the comparison and leaves the difference null when no correction is saved', () => {
  const props = { deviceRotation: deviceOrientationToMatrix(-179, 90, 0), compassHeading: 0 }
  expect(renderToStaticMarkup(<NorthCorrectionDiagnostics {...props} northCorrection={-179} />))
    .toContain('difference</dt><dd>-2.0°')
  expect(renderToStaticMarkup(<NorthCorrectionDiagnostics {...props} northCorrection={null} />))
    .toContain('difference</dt><dd>null')
})

it.each([
  { deviceRotation: null, compassHeading: 0, reason: 'device rotation unavailable' },
  { deviceRotation: deviceOrientationToMatrix(0, 0, 0), compassHeading: 0, reason: 'camera too vertical' },
  { deviceRotation: deviceOrientationToMatrix(0, 90, 0), compassHeading: null, reason: 'compass unavailable' },
])('shows why the candidate is unavailable: $reason', ({ reason, ...props }) => {
  const html = renderToStaticMarkup(<NorthCorrectionDiagnostics {...props} northCorrection={0} />)
  expect(html).toContain(`candidate status</dt><dd>${reason}`)
  expect(html).toContain('candidate northCorrection</dt><dd>null')
  expect(html).toContain('difference</dt><dd>null')
})
