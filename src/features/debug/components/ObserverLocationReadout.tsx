import type { UserLocation } from '../../geolocation/types'
import './ObserverLocationReadout.css'

function value(number: number | null | undefined, digits: number, unit: string) {
  return number != null && Number.isFinite(number) ? `${number.toFixed(digits)}${unit}` : 'unavailable (未取得)'
}

export function ObserverLocationReadout({ location }: { location: UserLocation | null }) {
  return <section className="observer-location-readout" aria-label="Current location">
    <h3>Current location / 現在地</h3>
    <dl>
      <div><dt>Latitude / 緯度</dt><dd>{value(location?.latitude, 6, '°')}</dd></div>
      <div><dt>Longitude / 経度</dt><dd>{value(location?.longitude, 6, '°')}</dd></div>
      <div><dt>Elevation / 現在地の高度</dt><dd>{value(location?.altitude, 1, ' m')}</dd></div>
    </dl>
  </section>
}
