import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import App from './App'

vi.mock('./hooks/useGeolocation', () => ({
  useGeolocation: () => ({ state: { status: 'idle' }, requestLocation: vi.fn() }),
}))
vi.mock('./pages/HomePage', () => ({ HomePage: () => <main>HOME_PAGE</main> }))
vi.mock('./pages/DebugPage', () => ({ DebugPage: () => <main>DEBUG_PAGE</main> }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('debug route availability', () => {
  it.each([
    { dev: true, enabled: undefined, pathname: '/debug', expected: 'DEBUG_PAGE' },
    { dev: true, enabled: 'false', pathname: '/debug', expected: 'DEBUG_PAGE' },
    { dev: false, enabled: 'true', pathname: '/debug', expected: 'DEBUG_PAGE' },
    { dev: false, enabled: 'true', pathname: '/debug/', expected: 'DEBUG_PAGE' },
    { dev: false, enabled: undefined, pathname: '/debug', expected: 'HOME_PAGE' },
    { dev: false, enabled: 'false', pathname: '/debug', expected: 'HOME_PAGE' },
    { dev: false, enabled: 'TRUE', pathname: '/debug', expected: 'HOME_PAGE' },
    { dev: false, enabled: 'true', pathname: '/', expected: 'HOME_PAGE' },
  ])('DEV=$dev, VITE_ENABLE_DEBUG=$enabled, path=$pathname → $expected', ({ dev, enabled, pathname, expected }) => {
    vi.stubEnv('DEV', dev)
    vi.stubEnv('VITE_ENABLE_DEBUG', enabled)
    vi.stubGlobal('window', { location: { pathname } })

    expect(renderToStaticMarkup(<App />)).toBe(`<main>${expected}</main>`)
  })
})
