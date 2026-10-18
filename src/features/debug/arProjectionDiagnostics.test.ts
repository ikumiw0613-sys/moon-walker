import { describe, expect, it } from 'vitest'
import { getMoonDeviceState } from '../moon-guide/moonDeviceNavigation'
import { projectMoonToScreen } from '../moon-guide/moonProjection'
import { aspectFromFov, compareProjections, fovConsistency, horizontalFov, projectWithDiagnosticFov,
  readARProjectionFlags, selectDiagnosticFov, verticalFov, viewportToWindow } from './arProjectionDiagnostics'

const windowSize = { width: 390, height: 844 }
const viewport = { left: 20, top: 100, width: 350, height: 500 }
const center = { x: .5, y: .5, visible: true }

describe('AR placement coordinates', () => {
  it('maps viewport-relative normalized coordinates into window pixels and normalization', () => {
    const result = viewportToWindow({ x: .25, y: .75, visible: true }, viewport, windowSize)!
    expect(result.windowX).toBe(107.5)
    expect(result.windowY).toBe(475)
    expect(result.normalizedWindowX).toBeCloseTo(107.5 / 390)
    expect(result.normalizedWindowY).toBeCloseTo(475 / 844)
  })
  it('preserves normalized screen coordinates when the rect covers the entire window', () => {
    const result = viewportToWindow({ x: .2, y: .8, visible: true }, { left: 0, top: 0, ...windowSize }, windowSize)!
    expect(result.normalizedWindowX).toBeCloseTo(.2)
    expect(result.normalizedWindowY).toBeCloseTo(.8)
  })
  it('a central panel changes window positions even for a forward-facing moon', () => {
    const panel = viewportToWindow(center, viewport, windowSize)!
    const full = viewportToWindow(center, { left: 0, top: 0, ...windowSize }, windowSize)!
    expect(panel.windowX).toBe(195)
    expect(panel.windowY).toBe(350)
    expect(full.windowY).toBe(422)
    expect(full.windowY - panel.windowY).toBe(72)
    expect(panel.normalizedWindowY).not.toBe(center.y)
  })
  it('does not invent positions before a layout measurement exists', () => {
    expect(viewportToWindow(center, null, windowSize)).toBeNull()
    expect(viewportToWindow(center, viewport, { width: 0, height: 0 })).toBeNull()
    expect(viewportToWindow({ ...center, x: NaN }, viewport, windowSize)).toBeNull()
    // A collapsed grid row is itself diagnostic evidence; still report its resulting pixel position.
    expect(viewportToWindow(center, { ...viewport, height: 0 }, windowSize)!.windowY).toBe(100)
  })
})

describe('FOV and physical rectangle aspect', () => {
  it('fixed 90/60 assumes sqrt(3) aspect, independent of the DOM rectangle', () => {
    expect(aspectFromFov({ horizontal: 90, vertical: 60 })).toBeCloseTo(Math.sqrt(3))
    expect(aspectFromFov({ horizontal: 90, vertical: 90 })).toBeCloseTo(1)
    const result = fovConsistency(viewport, { horizontal: 90, vertical: 60 })!
    expect(result.aspect).toBe(.7)
    expect(result.mismatchPercent).toBeCloseTo((.7 / Math.sqrt(3) - 1) * 100)
    expect(result.warning).toBe(true)
  })
  it.each([.46, .7, 1, Math.sqrt(3), 2])('derives either FOV with aspect %s', aspect => {
    expect(aspectFromFov({ horizontal: 90, vertical: verticalFov(90, aspect) })).toBeCloseTo(aspect)
    expect(aspectFromFov({ horizontal: horizontalFov(60, aspect), vertical: 60 })).toBeCloseTo(aspect)
  })
  it('sandbox modes use the chosen window/viewport aspect without changing production', () => {
    const windowFov = selectDiagnosticFov('window-h', windowSize, viewport)!
    const viewportFov = selectDiagnosticFov('viewport-h', windowSize, viewport)!
    expect(windowFov.horizontal).toBe(90)
    expect(aspectFromFov(windowFov)).toBeCloseTo(390 / 844)
    expect(aspectFromFov(viewportFov)).toBeCloseTo(.7)
    expect(fovConsistency(viewport, viewportFov)!.warning).toBe(false)
    const vertical = selectDiagnosticFov('viewport-v', windowSize, viewport)!
    expect(vertical.vertical).toBe(60)
    expect(aspectFromFov(vertical)).toBeCloseTo(.7)
    expect(selectDiagnosticFov('square', null, null)).toEqual({ horizontal: 90, vertical: 90 })
    expect(selectDiagnosticFov('viewport-h', null, null)).toBeNull()
    expect(aspectFromFov({ horizontal: 180, vertical: 60 })).toBeNull()
    expect(fovConsistency({ width: 0, height: 0 }, viewportFov)).toBeNull()
  })
  it('the diagnostic production preset reproduces existing projection numerically', () => {
    const fov = selectDiagnosticFov('production', null, null)!
    for (const moon of [{ x: 0, y: 0, z: -1 }, { x: .4, y: .2, z: -1 }, { x: -2, y: -3, z: -1 }]) {
      const actual = projectMoonToScreen(moon)
      const diagnostic = projectWithDiagnosticFov(moon, fov)!
      expect(diagnostic.x).toBeCloseTo(actual.x)
      expect(diagnostic.y).toBeCloseTo(actual.y)
      expect(diagnostic.visible).toBe(actual.visible)
    }
    expect(projectWithDiagnosticFov({ x: 0, y: 0, z: 1 }, fov)).toBeNull()
    expect(projectWithDiagnosticFov({ x: NaN, y: 0, z: -1 }, fov)).toBeNull()
  })
})

describe('same-input 2D and 3D comparison', () => {
  it('separates linear angle mapping from perspective without changing the saved correction or vectors', () => {
    const moon = Object.freeze({ azimuth: 22.5, altitude: 0, isAboveHorizon: true })
    const orientation = Object.freeze({ alpha: 0, beta: 90, gamma: 0 })
    const state = getMoonDeviceState(orientation, 0, moon)
    const before = JSON.stringify(state)
    const comparison = compareProjections(moon, state.correctedView, state.moonInDevice)
    expect(comparison.azimuthDifference).toBeCloseTo(22.5)
    expect(comparison.twoD!.x).toBeCloseTo(75)
    expect(comparison.production.screen!.x).toBeCloseTo((1 + Math.tan(Math.PI / 8)) / 2)
    expect(comparison.deltaX).toBeCloseTo(-.0428932188)
    expect(comparison.deltaY).toBeCloseTo(0)
    for (const mode of ['production', 'square', 'window-h', 'viewport-h', 'viewport-v'] as const) {
      projectWithDiagnosticFov(state.moonInDevice, selectDiagnosticFov(mode, windowSize, viewport))
    }
    expect(JSON.stringify(state)).toBe(before)
    expect(getMoonDeviceState(orientation, 0, moon)).toEqual(state)
  })
  it('does not compare fabricated center values when behind the camera or heading is undefined', () => {
    const comparison = compareProjections({ azimuth: 180, altitude: 0 }, { azimuth: 0, altitude: 0 }, { x: 0, y: 0, z: 1 })
    expect(comparison.production.reason).toBe('behind camera')
    expect(comparison.deltaX).toBeNull()
    expect(compareProjections(null, null, null).twoD).toBeNull()
    expect(compareProjections({ azimuth: 0, altitude: 90 }, null, { x: 0, y: 0, z: -1 }).twoD).toBeNull()
  })
  it('requires the explicit diagnostic query before allowing full-screen placement', () => {
    expect(readARProjectionFlags('')).toEqual({ enabled: false, placement: 'viewport' })
    expect(readARProjectionFlags('?arProjection=full-screen')).toEqual({ enabled: false, placement: 'viewport' })
    expect(readARProjectionFlags('?arDebug=projection')).toEqual({ enabled: true, placement: 'viewport' })
    expect(readARProjectionFlags('?arDebug=projection&arProjection=full-screen')).toEqual({ enabled: true, placement: 'full-screen' })
  })
})
