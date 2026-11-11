import { useSyncExternalStore } from 'react'

const DESKTOP_QUERY = '(min-width: 768px)'

function getDesktopSnapshot(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(DESKTOP_QUERY).matches
    : false
}

function subscribeToDesktopChanges(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}

  const mediaQuery = window.matchMedia(DESKTOP_QUERY)
  mediaQuery.addEventListener('change', onChange)
  return () => mediaQuery.removeEventListener('change', onChange)
}

export function useDesktopViewport(): boolean {
  return useSyncExternalStore(subscribeToDesktopChanges, getDesktopSnapshot, () => false)
}
