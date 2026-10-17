import { describe, expect, it } from 'vitest'
import type { Vector3 } from '../../shared/math/types'
import { getMoonProjectionDiagnostics, projectMoonToScreen } from './moonProjection'

describe('getMoonProjectionDiagnostics', () => {
  it('reports the production screen center and FOV for a Moon in front', () => {
    expect(getMoonProjectionDiagnostics({ x: 0, y: 0, z: -1 })).toEqual({
      screen: { x: 0.5, y: 0.5, visible: true },
      depth: 1,
      normalizedX: 0,
      normalizedY: 0,
      horizontalFov: 90,
      verticalFov: 60,
      reason: null,
    })
  })

  it('maps right and up into the expected screen directions', () => {
    const right = getMoonProjectionDiagnostics({ x: 0.25, y: 0, z: -1 })
    expect(right.screen?.x).toBeGreaterThan(0.5)
    expect(right.normalizedX).toBeGreaterThan(0)
    const up = getMoonProjectionDiagnostics({ x: 0, y: 0.25, z: -1 })
    expect(up.screen?.y).toBeLessThan(0.5)
    expect(up.normalizedY).toBeGreaterThan(0)
  })

  it.each([
    { moon: { x: 0.5, y: 0.5, z: 1 }, depth: -1, reason: 'behind camera' },
    { moon: { x: 0.5, y: 0.5, z: 0 }, depth: -0, reason: 'on camera plane' },
  ])('retains the existing early-return screen for $reason', ({ moon, depth, reason }) => {
    expect(getMoonProjectionDiagnostics(moon)).toMatchObject({
      screen: { x: 0.5, y: 0.5, visible: false },
      depth,
      normalizedX: null,
      normalizedY: null,
      reason,
    })
  })

  it('matches the exact production result across front, offscreen and behind fixtures', () => {
    for (const x of [-4, -1, -0.125, 0, 0.125, 1, 4]) {
      for (const y of [-2, -0.5, 0, 0.5, 2]) {
        for (const z of [-10, -1, -0.01, 0, 1]) {
          const moon = { x, y, z }
          const diagnostic = getMoonProjectionDiagnostics(moon)
          const screen = projectMoonToScreen(moon)
          expect(diagnostic.screen).toEqual(screen)
          if (z < 0) {
            // These inverses describe the same output consumed by MoonSprite.
            expect(diagnostic.normalizedX).toBe(2 * screen.x - 1)
            expect(diagnostic.normalizedY).toBe(1 - 2 * screen.y)
          }
        }
      }
    }
  })

  it('leaves projection coordinates invariant under positive vector scaling', () => {
    const moon = { x: 0.25, y: -0.15, z: -0.75 }
    const reference = getMoonProjectionDiagnostics(moon)
    for (const scale of [0.001, 0.5, 2, 1000]) {
      const diagnostic = getMoonProjectionDiagnostics({
        x: moon.x * scale,
        y: moon.y * scale,
        z: moon.z * scale,
      })
      expect(diagnostic.screen?.x).toBeCloseTo(reference.screen!.x, 12)
      expect(diagnostic.screen?.y).toBeCloseTo(reference.screen!.y, 12)
      expect(diagnostic.screen?.visible).toBe(reference.screen!.visible)
      expect(diagnostic.normalizedX).toBeCloseTo(reference.normalizedX!, 12)
      expect(diagnostic.normalizedY).toBeCloseTo(reference.normalizedY!, 12)
      expect(diagnostic.depth).toBeCloseTo(reference.depth! * scale, 12)
    }
  })

  it('reports missing input without replacing unavailable values with zero', () => {
    expect(getMoonProjectionDiagnostics(null)).toEqual({
      screen: null,
      depth: null,
      normalizedX: null,
      normalizedY: null,
      horizontalFov: 90,
      verticalFov: 60,
      reason: 'moonInDevice unavailable',
    })
  })

  it('safely rejects non-finite input in each axis, including behind-camera input', () => {
    for (const axis of ['x', 'y', 'z'] as const) {
      for (const value of [NaN, Infinity, -Infinity]) {
        for (const z of [-1, 1]) {
          const moon: Vector3 = { x: 0, y: 0, z, [axis]: value }
          expect(getMoonProjectionDiagnostics(moon)).toMatchObject({
            screen: null,
            depth: null,
            normalizedX: null,
            normalizedY: null,
            reason: 'projection unavailable (non-finite input)',
          })
        }
      }
    }
  })

  it.each([
    { x: Number.MAX_VALUE, y: 0, z: -Number.MIN_VALUE },
    { x: 0, y: Number.MAX_VALUE, z: -Number.MIN_VALUE },
  ])('safely rejects finite input whose projection overflows: %j', (moon) => {
    expect(getMoonProjectionDiagnostics(moon)).toMatchObject({
      screen: null,
      depth: null,
      normalizedX: null,
      normalizedY: null,
      reason: 'projection unavailable (non-finite output)',
    })
  })

  it('does not mutate the Moon vector', () => {
    const moon = Object.freeze({ x: 0.3, y: -0.2, z: -1 })
    getMoonProjectionDiagnostics(moon)
    expect(moon).toEqual({ x: 0.3, y: -0.2, z: -1 })
  })
})
