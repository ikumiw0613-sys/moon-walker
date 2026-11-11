import type { GeolocationDiagnostics } from './types'

function formatTime(timestamp: number | null): string {
  return timestamp === null ? '—' : new Date(timestamp).toLocaleTimeString('ja-JP', { hour12: false })
}

function errorName(code: number | null): string {
  if (code === 1) return 'PERMISSION_DENIED'
  if (code === 2) return 'POSITION_UNAVAILABLE'
  if (code === 3) return 'TIMEOUT'
  return code === null ? 'No Geolocation error code' : 'UNKNOWN_ERROR'
}

function browserName(userAgent: string): string {
  if (/Edg\//.test(userAgent)) return 'Other'
  if (/Chrome\//.test(userAgent)) return 'Chrome'
  if (/Safari\//.test(userAgent)) return 'Safari'
  return 'Other'
}

export function GeolocationDebugCard({ diagnostics }: { diagnostics?: GeolocationDiagnostics }) {
  if (!diagnostics) return null
  const userAgent = typeof navigator === 'undefined' ? 'unavailable' : navigator.userAgent
  const location = diagnostics.lastSuccess
  return <section className="debug-panel geo-debug" aria-labelledby="geo-debug-title">
    <h2 id="geo-debug-title">Geolocation / Browser Debug</h2>
    <dl className="debug-data">
      <div><dt>navigator.geolocation</dt><dd>{typeof navigator !== 'undefined' && navigator.geolocation ? 'available' : 'unsupported'}</dd></div>
      <div><dt>secureContext</dt><dd>{typeof window !== 'undefined' ? String(window.isSecureContext) : 'unavailable'}</dd></div>
      <div><dt>Browser</dt><dd>{browserName(userAgent)}</dd></div>
      <div><dt>userAgent</dt><dd>{userAgent}</dd></div>
      <div><dt>visibilityState</dt><dd>{typeof document !== 'undefined' ? document.visibilityState : 'unavailable'}</dd></div>
      <div><dt>status</dt><dd>{diagnostics.status}</dd></div>
      <div><dt>permission</dt><dd>{diagnostics.permission}</dd></div>
      <div><dt>last error</dt><dd>{diagnostics.lastError
        ? <>{errorName(diagnostics.lastError.code)} ({diagnostics.lastError.code ?? '—'})<br />{diagnostics.lastError.message}</>
        : '—'}</dd></div>
      <div><dt>last success</dt><dd>{location
        ? <>latitude: {location.latitude}<br />longitude: {location.longitude}<br />accuracy: {location.accuracy} m<br />timestamp: {new Date(location.timestamp).toLocaleString()}</>
        : '—'}</dd></div>
      <div><dt>request started</dt><dd>{formatTime(diagnostics.requestStarted)}</dd></div>
      <div><dt>request finished</dt><dd>{formatTime(diagnostics.requestFinished)}</dd></div>
      <div><dt>options</dt><dd>{diagnostics.options
        ? `enableHighAccuracy: ${diagnostics.options.enableHighAccuracy}, timeout: ${diagnostics.options.timeout}, maximumAge: ${diagnostics.options.maximumAge}`
        : 'not specified'}</dd></div>
    </dl>
    <h3>Event history (latest 10)</h3>
    {diagnostics.events.length ? <ol className="geo-debug-events">{diagnostics.events.map((event, index) =>
      <li key={`${event.timestamp}-${index}`}><time>{formatTime(event.timestamp)}</time> {event.message}</li>,
    )}</ol> : <p>No events</p>}
  </section>
}
