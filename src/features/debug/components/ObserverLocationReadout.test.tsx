import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { ObserverLocationReadout } from './ObserverLocationReadout'

it('displays coordinates in degrees and device elevation in meters', () => {
  const html = renderToStaticMarkup(<ObserverLocationReadout location={{
    latitude: 35.681236, longitude: 139.767125, altitude: 42.3, accuracy: 10, timestamp: 0,
  }} />)
  for (const text of ['35.681236°', '139.767125°', '42.3 m', '現在地の高度']) expect(html).toContain(text)
})

it.each([null, undefined, NaN, Infinity])('shows unavailable for elevation %s without losing coordinates', altitude => {
  const html = renderToStaticMarkup(<ObserverLocationReadout location={{
    latitude: 35, longitude: 139, altitude, accuracy: 10, timestamp: 0,
  }} />)
  expect(html).toContain('35.000000°')
  expect(html).toContain('139.000000°')
  expect(html).toContain('unavailable (未取得)')
})

it('shows unavailable when location has not been acquired', () => {
  const html = renderToStaticMarkup(<ObserverLocationReadout location={null} />)
  expect(html.match(/unavailable \(未取得\)/g)).toHaveLength(3)
})
