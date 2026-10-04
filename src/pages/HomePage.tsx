import { GeolocationControls } from '../components/GeolocationControls'
import type { LocationState } from '../types/geolocation'
import './Page.css'

export function HomePage({ state, requestLocation }: { state: LocationState; requestLocation: () => Promise<void> }) {
  return (
    <main className="home-screen location-screen">
      <section className="home-content" aria-labelledby="app-title">
        <h1 id="app-title">moon-walker</h1>
        <p className="home-description">現在地を表示します。</p>
        <GeolocationControls state={state} onRequestLocation={requestLocation} />
      </section>
    </main>
  )
}