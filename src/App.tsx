import { useEffect, useState } from 'react'
import { HomePage } from './pages/HomePage'
import { DebugPage } from './pages/DebugPage'
import { useGeolocation } from './hooks/useGeolocation'

function App() {
  const location = useGeolocation()
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const isDebugPage = pathname === '/debug' || pathname === '/debug/'

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return isDebugPage ? <DebugPage {...location} /> : <HomePage {...location} />
}

export default App
