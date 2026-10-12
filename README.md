# moon-walker

現在地と端末の向きを利用して、月がある方向を直感的に確認できるWebアプリです。

## Demo

https://moon-walker.vercel.app/

※現在開発中です

## 主な機能

- 現在地の取得
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

## 今後やること
- [] 探す画面をARっぽくする
- [] 月の満ち欠けによって表示を変える
- [] 補正値の調整
- [] AR画面の情報を整理する
- [] 操作案内の強化
- [] 月齢の表示
