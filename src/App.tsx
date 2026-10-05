import { useEffect, useState } from 'react'
import { HomePage } from './pages/HomePage'
import { DebugPage } from './pages/DebugPage'
import { useGeolocation } from './hooks/useGeolocation'
import { NorthCalibrationProvider } from './contexts/NorthCalibrationContext'
import { CalibrationPage } from './pages/CalibrationPage'
import { ARPage } from './pages/ARPage'
import { MoonInfoPage } from './pages/MoonInfoPage'
import { SettingsPage } from './pages/SettingsPage'
import type { AppPath } from './components/AppNavigation'

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

  function navigate(path: AppPath) {
    if (window.location.pathname !== path) window.history.pushState(null, '', path)
    setPathname(path)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const route = pathname.replace(/\/$/, '') || '/'
  const page = route === '/calibration' ? <CalibrationPage navigate={navigate} />
    : route === '/ar' ? <ARPage navigate={navigate} {...location} />
      : route === '/moon-info' ? <MoonInfoPage navigate={navigate} />
        : route === '/settings' ? <SettingsPage navigate={navigate} />
          : <HomePage navigate={navigate} />

  return (
    <NorthCalibrationProvider>
      {isDebugPage ? <DebugPage {...location} /> : page}
    </NorthCalibrationProvider>
  )
}

export default App
