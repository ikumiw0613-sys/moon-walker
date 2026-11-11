import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GeolocationDebugCard } from './GeolocationDebugCard'

const base = {
  status: 'idle' as const, permission: 'unsupported', lastError: null, lastSuccess: null,
  requestStarted: null, requestFinished: null, events: [], options: null,
}

describe('GeolocationDebugCard', () => {
  it('renders no diagnostics when not supplied', () => {
    expect(renderToStaticMarkup(<GeolocationDebugCard />)).toBe('')
  })

  it.each(['granted', 'prompt', 'denied', 'unsupported'])('shows permission state %s', permission => {
    expect(renderToStaticMarkup(<GeolocationDebugCard diagnostics={{ ...base, permission }} />)).toContain(`<dd>${permission}</dd>`)
  })

  it.each([[1, 'PERMISSION_DENIED'], [2, 'POSITION_UNAVAILABLE'], [3, 'TIMEOUT']])(
    'labels geolocation error %i', (code, name) => {
      const html = renderToStaticMarkup(<GeolocationDebugCard diagnostics={{ ...base,
        status: 'error', lastError: { code, message: 'Browser error detail' } }} />)
      expect(html).toContain(`${name} (${code})`)
      expect(html).toContain('Browser error detail')
    },
  )
})
