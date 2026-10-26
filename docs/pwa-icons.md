# PWA icons

既存の`public/moon-image.png`を拡縮し、アプリ背景と同じ`#0c1424`の不透明な背景に合成する。月の模様は変更しない。元画像と、月表示・ARの配置計算はそのまま維持する。

| ファイル | サイズ | 用途 |
| --- | --- | --- |
| `public/apple-touch-icon.png` | 180×180 | iPhoneのホーム画面。`index.html`に設定済み |
| `public/icons/icon-192.png` | 192×192 | PWA manifestの`purpose: any`用 |
| `public/icons/icon-512.png` | 512×512 | PWA manifestの`purpose: any`用 |
| `public/icons/icon-maskable-512.png` | 512×512 | PWA manifestの`purpose: maskable`用 |

通常版は月の直径をアイコン幅の74%に、maskable版は70%にする。中央と直径は既存`src/features/moon/moonDiscGeometry.ts`の`SOURCE_MOON_IMAGE`から読み取り、透明な余白を除いた月の中心をアイコン中央へ合わせる。角丸は画像へ焼き込まず、端末側の表示に任せる。

Windowsでの再生成:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-app-icons.ps1
```

今回追加するのは画像とApple Touch Iconの指定。manifest、Service Worker、オフライン起動はPWA対応の次の作業で追加する。
