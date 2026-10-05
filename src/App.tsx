import { useEffect, useState } from 'react'
import { HomePage } from './pages/HomePage'
import { DebugPage } from './pages/DebugPage'
import { useGeolocation } from './hooks/useGeolocation'
import { NorthCalibrationProvider } from './contexts/NorthCalibrationContext'

function App() {
  const location = useGeolocation()
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const debugEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG === 'true'
  const isDebugPage = debugEnabled && (pathname === '/debug' || pathname === '/debug/')

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return (
    <NorthCalibrationProvider>
      {isDebugPage ? <DebugPage {...location} /> : <HomePage {...location} />}
    </NorthCalibrationProvider>
  )
}

export default App
