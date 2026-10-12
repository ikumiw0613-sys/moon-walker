import { expect, it } from 'vitest'
import { getMoonEdgePosition, projectMoonToScreen } from './moonProjection'

it('projects a forward-facing Moon to the center and hides one behind the camera', () => {
  expect(projectMoonToScreen({ x: 0, y: 0, z: -1 })).toEqual({ x: 0.5, y: 0.5, visible: true })
  const behind = projectMoonToScreen({ x: 0, y: 0, z: 1 })
  expect(behind.visible).toBe(false)
  expect(getMoonEdgePosition(behind)).toEqual({ x: 0.5, y: 0.8 })
})

it('keeps offscreen markers inside the viewport and preserves their direction', () => {
  for (const [x, y] of [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2]]) {
    const point = projectMoonToScreen({ x, y, z: -1 })
    expect(point.visible).toBe(false)
    const edge = getMoonEdgePosition(point)
    expect(edge.x).toBeGreaterThanOrEqual(0.1 - 1e-10)
    expect(edge.x).toBeLessThanOrEqual(0.9 + 1e-10)
    expect(edge.y).toBeGreaterThanOrEqual(0.1 - 1e-10)
    expect(edge.y).toBeLessThanOrEqual(0.9 + 1e-10)
    expect(Math.sign(edge.x - 0.5)).toBe(Math.sign(x))
    expect(Math.sign(edge.y - 0.5)).toBe(-Math.sign(y) || 0)
  }
})
