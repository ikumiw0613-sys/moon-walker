// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { GEOLOCATION_OPTIONS, getCurrentLocation } from './geolocation'

afterEach(() => vi.unstubAllGlobals())

it.each([42.3, 0, -12, null, undefined, NaN, Infinity])('preserves device altitude %s or marks it unavailable', async altitude => {
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('navigator', { geolocation: {
    getCurrentPosition: (success: (position: unknown) => void) => success({
      coords: { latitude: 35, longitude: 139, altitude, accuracy: 10 }, timestamp: 123,
    }),
  } })
  await expect(getCurrentLocation()).resolves.toEqual({
    latitude: 35, longitude: 139, accuracy: 10, timestamp: 123,
    altitude: altitude != null && Number.isFinite(altitude) ? altitude : null,
  })
})

it.each([
  [1, 'User denied Geolocation'],
  [2, 'Position unavailable'],
  [3, 'Timeout expired'],
])('records error callback code %i and message', async (code, message) => {
  vi.stubGlobal('isSecureContext', true)
  const callback = vi.fn()
  vi.stubGlobal('navigator', { geolocation: {
    getCurrentPosition: (_success: unknown, error: (value: unknown) => void, options: unknown) => {
      expect(options).toEqual(GEOLOCATION_OPTIONS)
      error({ code, message })
    },
  } })
  await expect(getCurrentLocation(callback)).rejects.toMatchObject({ code })
  expect(callback).toHaveBeenCalledWith('request started')
  expect(callback).toHaveBeenCalledWith('error callback', { code, message })
})

it('reports geolocation as unsupported without calling the API', async () => {
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('navigator', {})
  const callback = vi.fn()
  await expect(getCurrentLocation(callback)).rejects.toBeInstanceOf(Error)
  expect(callback).not.toHaveBeenCalled()
})

it('records the success callback', async () => {
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('navigator', { geolocation: {
    getCurrentPosition: (success: (position: unknown) => void) => success({
      coords: { latitude: 35, longitude: 139, altitude: null, accuracy: 10 }, timestamp: 123,
    }),
  } })
  const callback = vi.fn()
  await getCurrentLocation(callback)
  expect(callback).toHaveBeenCalledWith('success callback')
})
