/** Keep the explicit diagnostic query only during the AR <-> calibration round trip.
 * No persistent flag: removing the query or leaving this pair ends the diagnostic flow.
 */
export function projectionDiagnosticDestination(currentPath: string, search: string, destination: string): string {
  const isAROrCalibration = (path: string) => ['/ar', '/calibration'].includes(path.replace(/\/$/, ''))
  const source = new URLSearchParams(search)
  if (!isAROrCalibration(currentPath) || !isAROrCalibration(destination) || source.get('arDebug') !== 'projection') return destination
  const query = new URLSearchParams({ arDebug: 'projection' })
  if (source.get('arProjection') === 'full-screen') query.set('arProjection', 'full-screen')
  return `${destination}?${query}`
}
