import { useCallback, useEffect, useState } from 'react'
import type { Navigate } from './AppNavigation'
import { projectionDiagnosticDestination } from './projectionDiagnosticNavigation'

export function useNavigation() {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate: Navigate = useCallback((path, options) => {
    if (window.location.pathname !== path) {
      const destination = projectionDiagnosticDestination(window.location.pathname, window.location.search, path)
      if (options?.replace) window.history.replaceState(null, '', destination)
      else window.history.pushState(null, '', destination)
    }
    setPathname(path)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  return { pathname, navigate }
}
