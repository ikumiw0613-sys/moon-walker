import { useEffect, useState } from 'react'

export function useScreenOrientationAngle() {
  const [screenAngle, setScreenAngle] = useState<number | undefined>(() => window.screen.orientation?.angle)

  useEffect(() => {
    const screenOrientation = window.screen.orientation
    const updateScreenAngle = () => setScreenAngle(window.screen.orientation?.angle)
    screenOrientation?.addEventListener('change', updateScreenAngle)
    window.addEventListener('orientationchange', updateScreenAngle)
    return () => {
      screenOrientation?.removeEventListener('change', updateScreenAngle)
      window.removeEventListener('orientationchange', updateScreenAngle)
    }
  }, [])
  return screenAngle
}
