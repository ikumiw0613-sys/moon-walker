import { useEffect } from 'react'
import { GeolocationControls } from '../components/GeolocationControls'
import { useGeolocation } from '../hooks/useGeolocation'
import { getMoonPosition } from '../lib/astronomy'
import './HomePage.css'

export function HomePage() {
  const { state, requestLocation } = useGeolocation()

  useEffect(() => {
    if (state.status !== 'success') return
    const now = new Date()

    const { latitude, longitude} = state.location
    console.log("latitude:", latitude)
    console.log("longitude:", longitude)
    console.log("local time:", now.toString())
    console.log("UTC time:", now.toISOString())

    const moonPosition = getMoonPosition(latitude, longitude, now)

    if(moonPosition.isAboveHorizon) {
      console.log("月は地平線より上にあります")
    } else {
      console.log("月は地平線より下にあります")
    }



    console.log(moonPosition)
  }, [state])

  return (
    <main className="home-screen">
      <section className="home-content" aria-labelledby="app-title">
        <span className="moon" aria-hidden="true" />
        <h1 id="app-title">moon-walker</h1>
        <p className="home-description">
          今いる場所から月を見つけるWebアプリ。
          <br />
          顔を上げて、月を探してみよう。
        </p>
        <GeolocationControls state={state} onRequestLocation={requestLocation} />
      </section>
    </main>
  )
}
