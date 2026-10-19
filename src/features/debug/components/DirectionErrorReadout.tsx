import type { DirectionErrorDiagnostics } from '../directionErrorDiagnostics'
import './DirectionErrorReadout.css'

function degrees(value: number | null, signed = false) {
  if (value === null) return 'unavailable'
  const rounded = Number(value.toFixed(1))
  return `${signed && rounded > 0 ? '+' : ''}${rounded.toFixed(1)}°`
}

export function DirectionErrorReadout({ data }: { data: DirectionErrorDiagnostics }) {
  return <section className="direction-error-readout" aria-label="Direction error">
    <h3>Direction error</h3>
    <div className="direction-error-columns">
      <section aria-label="Heading error"><h4>Heading</h4><dl>
        <div><dt>Moon azimuth</dt><dd>{degrees(data.moonAzimuth)}</dd></div>
        <div><dt>Corrected heading</dt><dd>{degrees(data.correctedHeading)}</dd></div>
        <div><dt>Heading error</dt><dd>{degrees(data.headingError, true)}</dd></div>
      </dl></section>
      <section aria-label="Altitude error"><h4>Altitude</h4><dl>
        <div><dt>Moon altitude</dt><dd>{degrees(data.moonAltitude)}</dd></div>
        <div><dt>Corrected altitude</dt><dd>{degrees(data.correctedAltitude)}</dd></div>
        <div><dt>Altitude error</dt><dd>{degrees(data.altitudeError, true)}</dd></div>
      </dl></section>
    </div>
    <p>Main error axis: <strong>{data.mainErrorAxis}</strong></p>
  </section>
}
