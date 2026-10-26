import { HomePage } from '../pages/home/HomePage'
import { DebugPage } from '../pages/debug/DebugPage'
import { useGeolocation } from '../features/geolocation/useGeolocation'
import { NorthCalibrationProvider } from '../features/north-calibration/NorthCalibrationProvider'
import { CalibrationPage } from '../pages/calibration/CalibrationPage'
import { ARPage } from '../pages/ar/ARPage'
import { MoonInfoPage } from '../pages/moon-info/MoonInfoPage'
import { useNavigation } from './navigation/useNavigation'
import { ObservationTimeProvider } from '../shared/time/ObservationTimeProvider'
import { PWAUpdateNotice } from '../pwa/PWAUpdateNotice'

function App() {
  const location = useGeolocation()
  const { pathname, navigate } = useNavigation()
  const debugEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG === 'true'
  const isDebugPage = debugEnabled && (pathname === '/debug' || pathname === '/debug/')

  const route = pathname.replace(/\/$/, '') || '/'
  const page = route === '/calibration' ? <CalibrationPage navigate={navigate} />
    : route === '/ar' ? <ARPage navigate={navigate} {...location} />
      : route === '/moon-info' ? <MoonInfoPage navigate={navigate} {...location} />
        : <HomePage navigate={navigate} {...location} />

  return (
    <NorthCalibrationProvider>
      <ObservationTimeProvider>
        {isDebugPage ? <DebugPage {...location} /> : page}
        <PWAUpdateNotice pathname={route} />
      </ObservationTimeProvider>
    </NorthCalibrationProvider>
  )
}

export default App
