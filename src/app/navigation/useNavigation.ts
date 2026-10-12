import { useCallback, useEffect, useState } from 'react'
import type { Navigate } from './AppNavigation'

export function useNavigation() {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate: Navigate = useCallback((path, options) => {
    if (window.location.pathname !== path) {
      if (options?.replace) window.history.replaceState(null, '', path)
      else window.history.pushState(null, '', path)
    }
    setPathname(path)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  return { pathname, navigate }
}
