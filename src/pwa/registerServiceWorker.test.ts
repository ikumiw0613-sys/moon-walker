// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { registerServiceWorker } from './registerServiceWorker'
import { serviceWorkerUpdates } from './serviceWorkerUpdates'

vi.mock('./serviceWorkerUpdates', () => ({ serviceWorkerUpdates: { observe: vi.fn() } }))

afterEach(() => {
  vi.restoreAllMocks()
  vi.mocked(serviceWorkerUpdates.observe).mockClear()
  vi.unstubAllGlobals()
})

function setup(readyState: DocumentReadyState = 'complete') {
  const registration = { scope: 'https://moon.test/' } as ServiceWorkerRegistration
  const register = vi.fn().mockResolvedValue(registration)
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('navigator', { serviceWorker: { register } })
  vi.spyOn(document, 'readyState', 'get').mockReturnValue(readyState)
  return { registration, register }
}

it('waits for the initial page load and registers the root-scoped worker without using HTTP cache', async () => {
  const { register, registration } = setup('loading')
  const pending = registerServiceWorker()
  expect(register).not.toHaveBeenCalled()
  window.dispatchEvent(new Event('load'))
  await expect(pending).resolves.toBe(registration)
  expect(register).toHaveBeenCalledExactlyOnceWith('/sw.js', { scope: '/', updateViaCache: 'none' })
  expect(serviceWorkerUpdates.observe).toHaveBeenCalledExactlyOnceWith(registration)
  window.dispatchEvent(new Event('load'))
  expect(register).toHaveBeenCalledTimes(1)
})

it('also registers when the page has already finished loading', async () => {
  const { registration } = setup()
  await expect(registerServiceWorker()).resolves.toBe(registration)
})

it('skips unsupported or insecure environments', async () => {
  const { register } = setup()
  vi.stubGlobal('isSecureContext', false)
  await expect(registerServiceWorker()).resolves.toBeNull()
  expect(register).not.toHaveBeenCalled()
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('navigator', {})
  await expect(registerServiceWorker()).resolves.toBeNull()
})

it('contains a registration error instead of rejecting the app startup', async () => {
  const { register } = setup()
  register.mockRejectedValue(new Error('Network unavailable'))
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  await expect(registerServiceWorker()).resolves.toBeNull()
  expect(warning).toHaveBeenCalledOnce()
})
