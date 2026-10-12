// Temporarily freeze the normal pages at a time when the Moon is above Tokyo's horizon.
// Set this to null to resume using the device clock.
const FIXED_OBSERVATION_TIME: string | null = '2026-10-11T10:00:00+09:00'

export function getObservationTime(): Date {
  return FIXED_OBSERVATION_TIME === null ? new Date() : new Date(FIXED_OBSERVATION_TIME)
}
