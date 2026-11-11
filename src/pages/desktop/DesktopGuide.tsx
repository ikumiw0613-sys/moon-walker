import './DesktopGuide.css'

const APP_URL = 'https://moon-walker.vercel.app/'

export function DesktopGuide() {
  return <main className="desktop-guide">
    <section className="desktop-guide-card" aria-labelledby="desktop-guide-title">
      <p className="desktop-guide-brand">MOON WALKER</p>
      <h1 id="desktop-guide-title">月を探しにいこう</h1>
      <p className="desktop-guide-copy">
        moon-walkerはスマートフォンで<br className="desktop-guide-break" />月の方向を探すためのアプリです。
        <br />下のQRコードをスマートフォンで読み取って、<br className="desktop-guide-break" />月を探してみてください。
      </p>
      <div className="desktop-guide-qr-frame">
        <img
          className="desktop-guide-qr"
          src="/qrcode_moon-walker.vercel.app.png"
          alt="moon-walkerを開くQRコード"
          width="224"
          height="224"
        />
      </div>
      <p className="desktop-guide-scan">スマートフォンで読み取ってください</p>
      <a className="desktop-guide-url" href={APP_URL}>moon-walker.vercel.app</a>
    </section>
  </main>
}
