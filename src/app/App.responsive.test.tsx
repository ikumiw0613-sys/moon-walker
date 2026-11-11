// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

let pathname = '/ar'
vi.mock('../features/geolocation/useGeolocation', () => ({
  useGeolocation: () => ({ state: { status: 'idle' }, requestLocation: vi.fn() }),
}))
vi.mock('./navigation/useNavigation', () => ({
  useNavigation: () => ({ pathname, navigate: vi.fn() }),
}))
vi.mock('../pages/home/HomePage', () => ({ HomePage: () => <main>HOME_PAGE</main> }))
vi.mock('../pages/debug/DebugPage', () => ({ DebugPage: () => <main>DEBUG_PAGE</main> }))
vi.mock('../pages/ar/ARPage', () => ({ ARPage: () => <main>AR_PAGE</main> }))
vi.mock('../pages/calibration/CalibrationPage', () => ({ CalibrationPage: () => <main>CALIBRATION_PAGE</main> }))
vi.mock('../pages/moon-info/MoonInfoPage', () => ({ MoonInfoPage: () => <main>MOON_INFO_PAGE</main> }))
vi.mock('../features/north-calibration/NorthCalibrationProvider', () => ({ NorthCalibrationProvider: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('../shared/time/ObservationTimeProvider', () => ({ ObservationTimeProvider: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('../pwa/PWAUpdateNotice', () => ({ PWAUpdateNotice: () => null }))

const listeners = new Set<EventListener>()
let matches = false
const mediaQueryList = {
  media: '(min-width: 768px)',
  get matches() { return matches },
  onchange: null,
  addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => { listeners.add(listener as EventListener) },
  removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => { listeners.delete(listener as EventListener) },
  addListener: (_listener: () => void) => {},
  removeListener: (_listener: () => void) => {},
  dispatchEvent: () => true,
} as unknown as MediaQueryList

let root: Root | undefined
let container: HTMLDivElement | undefined

function renderAtWidth(width: number) {
  matches = width >= 768
  vi.stubGlobal('innerWidth', width)
  vi.stubGlobal('matchMedia', vi.fn(() => mediaQueryList))
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => root?.render(<App />))
  return container
}

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = undefined
  container = undefined
  listeners.clear()
  vi.unstubAllGlobals()
  pathname = '/ar'
})

describe('responsive desktop guide', () => {
  it.each([390, 430])('keeps the existing app at %ipx', (width) => {
    expect(renderAtWidth(width).textContent).toContain('AR_PAGE')
  })

  it.each([768, 1024, 1440])('shows only the QR guide at %ipx', (width) => {
    const view = renderAtWidth(width)
    expect(view.textContent).toContain('月を探しにいこう')
    expect(view.textContent).toContain('スマートフォンで読み取ってください')
    expect(view.textContent).not.toContain('AR_PAGE')
    const qr = view.querySelector<HTMLImageElement>('img')
    expect(qr?.getAttribute('src')).toBe('/qrcode_moon-walker.vercel.app.png')
    expect(view.querySelector('a')?.getAttribute('href')).toBe('https://moon-walker.vercel.app/')
  })

  it('switches the visible page when resizing across 768px', () => {
    const view = renderAtWidth(430)
    expect(view.textContent).toContain('AR_PAGE')

    matches = true
    act(() => listeners.forEach((listener) => listener(new Event('change'))))
    expect(view.textContent).toContain('月を探しにいこう')
    expect(view.textContent).not.toContain('AR_PAGE')

    matches = false
    act(() => listeners.forEach((listener) => listener(new Event('change'))))
    expect(view.textContent).toContain('AR_PAGE')
  })
})
