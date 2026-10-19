import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { getDirectionErrorDiagnostics } from './directionErrorDiagnostics'
import { DirectionErrorReadout } from './components/DirectionErrorReadout'

describe('direction error diagnostics', () => {
  it.each([
    [359, 1, -2], [1, 359, 2], [0, 180, -180], [180, 0, -180],
    [721, -1, 2], [-721, 1, -2],
  ])('wraps moon %s / camera %s to %s degrees', (moon, camera, expected) => {
    expect(getDirectionErrorDiagnostics({ azimuth: moon, altitude: 0 }, camera, 0).headingError).toBe(expected)
  })

  it.each([
    [10.5, 1.2, 'HEADING'], [1, -10, 'ALTITUDE'], [-10, 10, 'BOTH'],
    [3, -3, 'ALIGNED'], [0, 0, 'ALIGNED'], [4, 1, 'CAUTION'],
    [1, 4, 'CAUTION'], [5, 5, 'CAUTION'], [6, 4, 'CAUTION'], [4, 6, 'CAUTION'],
    [5, 0, 'CAUTION'], [0, 5, 'CAUTION'],
  ])('classifies heading %s / altitude %s as %s', (heading, altitude, expected) => {
    const result = getDirectionErrorDiagnostics({ azimuth: 100 + heading, altitude: 20 + altitude }, 100, 20)
    expect(result.headingError).toBeCloseTo(heading)
    expect(result.altitudeError).toBeCloseTo(altitude)
    expect(result.mainErrorAxis).toBe(expected)
  })

  it('keeps unavailable and invalid measurements separate from alignment', () => {
    expect(getDirectionErrorDiagnostics(null, 0, 0)).toMatchObject({
      headingError: null, altitudeError: null, mainErrorAxis: 'UNAVAILABLE',
    })
    expect(getDirectionErrorDiagnostics({ azimuth: 10, altitude: 90 }, null, 90)).toMatchObject({
      headingError: null, altitudeError: 0, mainErrorAxis: 'UNAVAILABLE',
    })
    expect(getDirectionErrorDiagnostics({ azimuth: NaN, altitude: 10 }, 0, Infinity)).toMatchObject({
      moonAzimuth: null, correctedAltitude: null, headingError: null, altitudeError: null, mainErrorAxis: 'UNAVAILABLE',
    })
  })

  it('shows all six angles, signed errors and the main axis', () => {
    const html = renderToStaticMarkup(<DirectionErrorReadout data={getDirectionErrorDiagnostics(
      { azimuth: 227.3, altitude: 8.6 }, 216.8, 7.4,
    )} />)
    for (const text of ['Moon azimuth', 'Corrected heading', 'Heading error', 'Moon altitude',
      'Corrected altitude', 'Altitude error', '227.3°', '216.8°', '+10.5°', '8.6°', '7.4°', '+1.2°', 'HEADING']) {
      expect(html).toContain(text)
    }
    expect(renderToStaticMarkup(<DirectionErrorReadout data={getDirectionErrorDiagnostics(null, null, null)} />))
      .toContain('UNAVAILABLE')
  })
})
