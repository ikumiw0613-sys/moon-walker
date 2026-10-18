import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { Rect } from './arProjectionDiagnostics'

const rect = (element: HTMLElement | null): Rect | null => {
  if (!element) return null
  const { left, top, width, height } = element.getBoundingClientRect()
  return { left, top, width, height }
}
export function readPositioningStyle(element: HTMLElement) {
  const style = getComputedStyle(element)
  return { element: `${element.tagName.toLowerCase()}${element.className ? '.' + element.className.trim().split(/\s+/).join('.') : ''}`,
    position: style.position, display: style.display, width: style.width, height: style.height,
    boxSizing: style.boxSizing, padding: style.padding, border: style.borderWidth,
    gridTemplateRows: style.gridTemplateRows, gridAutoRows: style.gridAutoRows, gridRow: style.gridRow,
    gridColumn: style.gridColumn, gap: style.gap,
    transform: style.transform, translate: style.translate, rotate: style.rotate, scale: style.scale,
    perspective: style.perspective, filter: style.filter, backdropFilter: style.backdropFilter,
    contain: style.contain, contentVisibility: style.contentVisibility, willChange: style.willChange,
    overflow: `${style.overflowX} / ${style.overflowY}` }
}
export function changesFixedContainingBlock(style: ReturnType<typeof readPositioningStyle>) {
  const nontrivial = (value: string) => !!value && value !== 'none' && value !== 'normal'
  return [style.transform, style.translate, style.rotate, style.scale, style.perspective, style.filter, style.backdropFilter].some(nontrivial)
    || /layout|paint|strict|content/.test(style.contain) || /transform|filter|perspective/.test(style.willChange)
    || style.contentVisibility === 'auto'
}
export function measureARProjection(viewport: HTMLElement | null, sprite: HTMLElement | null) {
  const ancestors: ReturnType<typeof readPositioningStyle>[] = []
  for (let element = viewport; element; element = element.parentElement) ancestors.push(readPositioningStyle(element))
  const spriteAncestors: ReturnType<typeof readPositioningStyle>[] = []
  for (let element = sprite?.parentElement; element; element = element.parentElement) spriteAncestors.push(readPositioningStyle(element))
  const viewportRect = rect(viewport)
  const spriteRect = rect(sprite)
  return { window: { width: window.innerWidth, height: window.innerHeight },
    visualViewport: window.visualViewport ? { width: window.visualViewport.width, height: window.visualViewport.height,
      offsetLeft: window.visualViewport.offsetLeft, offsetTop: window.visualViewport.offsetTop, scale: window.visualViewport.scale } : null,
    viewport: viewportRect, sprite: spriteRect, spriteStyle: sprite ? readPositioningStyle(sprite) : null,
    offsetParent: sprite?.offsetParent instanceof HTMLElement ? readPositioningStyle(sprite.offsetParent).element : null,
    ancestors, gridChildren: viewport?.parentElement ? [...viewport.parentElement.children].filter((child): child is HTMLElement => child instanceof HTMLElement)
      .map(child => ({ element: readPositioningStyle(child).element, gridRow: getComputedStyle(child).gridRow, rect: rect(child) })) : [],
    fixedContainingBlocks: spriteAncestors.filter(changesFixedContainingBlock).map(value => value.element),
    spriteCenter: spriteRect ? { x: spriteRect.left + spriteRect.width / 2, y: spriteRect.top + spriteRect.height / 2 } : null }
}
export type ARProjectionMeasurements = ReturnType<typeof measureARProjection>

/** Mounted ONLY with the explicit AR diagnostic query. No observers in normal AR. */
export function useARProjectionMeasurements(viewport: RefObject<HTMLDivElement | null>, sprite: RefObject<HTMLDivElement | null>, renderKey: string) {
  const [measurement, setMeasurement] = useState<ARProjectionMeasurements | null>(null)
  useLayoutEffect(() => {
    const update = () => {
      const next = measureARProjection(viewport.current, sprite.current)
      setMeasurement(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
    }
    update()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    if (viewport.current) observer?.observe(viewport.current)
    if (sprite.current) observer?.observe(sprite.current)
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    window.addEventListener('scroll', update, true)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    // Catches dynamic CSS / safe-area / browser chrome changes without changing the AR layout.
    const timer = window.setInterval(update, 250)
    return () => {
      observer?.disconnect()
      window.clearInterval(timer)
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      window.removeEventListener('scroll', update, true)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
    }
  }, [viewport, sprite, renderKey])
  return measurement
}
