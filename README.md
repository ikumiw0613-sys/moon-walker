# moon-walker

現在地と端末の向きを利用して、月がある方向を直感的に確認できるWebアプリです。

## Demo

https://moon-walker.vercel.app/

※現在開発中です

## 主な機能

- 現在地の取得
- ホーム画面で現在地の天気と雲量を表示（Open-Meteo）
- 月の位置計算
- 端末の向きの取得
- 月の方向表示
- センサーのキャリブレーション
- 月が地平線より下にある場合の表示
- センサー許可状態に応じた案内

## 技術スタック

- React
- TypeScript
- Vite
- Geolocation API
- DeviceOrientation API
- Vercel

## 開発

```sh
npm install
npm run dev
npm test -- --run
npm run build
npm run lint
```

ディレクトリの役割と依存関係のルールは [構成ガイド](./docs/architecture.md) を参照してください。
Debugの磁気環境診断と場所比較の実機確認は [コンパス診断ガイド](./docs/compass-diagnostics.md) を参照してください。
AR表示側のviewport・FOV・CSSの切り分けは [AR投影診断ガイド](./docs/ar-projection-diagnostics.md) を参照してください。

## 天気情報

月が出ていないときに、ホーム画面で現在地の天気と雲量を表示します。天気は「晴れ」「曇り」「雨」など簡潔な表記にします。月が地平線より上にある場合は、従来どおり準備画面へ自動で移動します。

[Open-Meteo Forecast API](https://open-meteo.com/en/docs) の現在の天気コードと雲量を利用し、位置情報取得後にブラウザーから緯度・経度を送信します。APIキーの設定は不要です。表示中は15分ごとに更新し、「天気を再取得」から手動更新できます。通信に失敗した場合はエラーを表示します。

天気は気象モデルの推定値です。対象時刻は日本時間で表示し、月の観測日時をテスト日時に固定していても天気は現在の情報を取得します。

## 今後やること
- [] 探す画面をARっぽくする
- [] 月の満ち欠けによって表示を変える
- [] 補正値の調整
- [] AR画面の情報を整理する
- [] 操作案内の強化
- [] 月齢の表示

