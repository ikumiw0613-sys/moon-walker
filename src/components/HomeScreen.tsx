export function HomeScreen() {
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
        <div className="home-action">
          <button
            className="find-moon-button"
            type="button"
            disabled
            aria-describedby="search-status"
          >
            月を探す
          </button>
          <p className="search-status" id="search-status">
            月を探す機能は、ただいま準備中です。
          </p>
        </div>
      </section>
    </main>
  )
}
