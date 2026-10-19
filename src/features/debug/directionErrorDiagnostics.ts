import { normalizeSignedAngle } from '../../shared/math/angles'

const finite = (value: number | null | undefined): number | null =>
  value != null && Number.isFinite(value) ? value : null

/** Read-only diagnostics. These values never feed back into orientation or projection. */
export function getDirectionErrorDiagnostics(
  moon: { azimuth: number; altitude: number } | null,
  heading: number | null,
  altitude: number | null,
) {
  const moonAzimuth = finite(moon?.azimuth)
  const moonAltitude = finite(moon?.altitude)
  const correctedHeading = finite(heading)
  const correctedAltitude = finite(altitude)
  const headingError = moonAzimuth !== null && correctedHeading !== null
    ? normalizeSignedAngle(moonAzimuth - correctedHeading) : null
  const altitudeError = moonAltitude !== null && correctedAltitude !== null
    ? moonAltitude - correctedAltitude : null
  const h = headingError === null ? null : Math.abs(headingError)
  const a = altitudeError === null ? null : Math.abs(altitudeError)
  const mainErrorAxis = h === null || a === null ? 'UNAVAILABLE'
    : h <= 3 && a <= 3 ? 'ALIGNED'
    : h > 5 && a <= 3 ? 'HEADING'
    : a > 5 && h <= 3 ? 'ALTITUDE'
    : h > 5 && a > 5 ? 'BOTH' : 'CAUTION'
  return { moonAzimuth, correctedHeading, headingError, moonAltitude, correctedAltitude, altitudeError, mainErrorAxis }
}

export type DirectionErrorDiagnostics = ReturnType<typeof getDirectionErrorDiagnostics>
