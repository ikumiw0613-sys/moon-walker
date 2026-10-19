// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { getCurrentLocation } from './geolocation'

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
