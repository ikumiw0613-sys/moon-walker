# ディレクトリ構成

関連するHook・型・計算処理・UIを機能ごとにまとめ、画面の組み立てと機能の実装を分ける。

```text
src/
├─ main.tsx                    # Reactの起動
├─ app/
│  ├─ App.tsx                  # 画面の選択・Providerの配置
│  ├─ navigation/              # 遷移処理・リンク・ナビゲーション
│  └─ tests/                   # 画面遷移・北補正の保持・Debug/ARの整合性
├─ pages/
│  ├─ home/                    # 現在地の月の状態を確認する画面
│  ├─ ar/                      # AR画面・表示状態のHook・専用部品
│  ├─ calibration/             # 北基準を合わせる画面
│  ├─ moon-info/               # 月の情報画面
│  ├─ settings/                # 設定画面
│  └─ debug/                   # 診断画面の組み立て
├─ features/
│  ├─ geolocation/             # 位置情報API・状態・取得操作UI
│  ├─ device-orientation/      # 向きセンサー・端末回転・北基準の変換
│  ├─ north-calibration/       # 校正の判定・Context・保存状態
│  ├─ moon/                    # 天文計算・月の型・月の出の書式
│  ├─ moon-guide/              # 月の端末座標・案内・画面投影
│  ├─ sky/                     # 星空の描画・背景・視差
│  └─ debug/                   # 診断表示・手動姿勢・仮想視点・太陽検証
└─ shared/
   ├─ math/                    # 角度・座標・ベクトル・行列の計算と型
   ├─ geo/                     # 地理的な方位・距離の計算
   ├─ time/                    # 通常画面の観測時刻
   └─ styles/                  # グローバル・複数画面共通のCSS
```

## 配置と依存のルール

- `app/App.tsx` はアプリ全体の状態と画面の選択を担当する。ブラウザー履歴の操作は `app/navigation/useNavigation.ts` に置く。
- `pages` は機能を組み合わせ、画面を構成する。画面遷移には `app/navigation` のリンクと型を使う。ナビゲーションから画面を参照しない。
- `features` は画面から独立した機能を担当する。画面専用の表示状態や部品は、その画面の近くに置く。
- `shared` は機能に依存しない処理だけを置く。`app`・`pages`・`features` を参照しない。
- 機能間の参照は必要な場合に許可するが、循環参照は作らない。端末姿勢と北補正の計算をUIの都合で複製しない。
- 特定の機能に属する型は、その機能の中に置く。汎用のベクトル・行列型は `shared/math/types.ts` に置く。
- コンポーネント専用CSSは隣に置く。共通の画面スタイルを先に、画面専用CSSを後に読み込む。
- 単体テストは対象ファイルの隣に置く。複数画面をまたぐテストは `app/tests` に置く。

`features/debug/debug-base.css` は診断画面とその部品が利用する基本スタイル。画面全体のレイアウトは `pages/debug/DebugPage.css` が担当する。

## 計算と状態の境界

`shared/math/vector3.ts` は方向ベクトル・回転行列・行列積を扱う。DeviceOrientationのZ-X-Y変換と保存済み北補正の適用は `features/device-orientation/deviceRotation.ts` が担当する。

`features/moon-guide/moonDeviceNavigation.ts` の `getMoonDeviceState` は、センサー姿勢・観測地点から計算した月・保存済み北補正を受け取り、DebugとAR共通の計算結果を返す。北補正は一度だけ適用する。

北補正の状態は `features/north-calibration/NorthCalibrationProvider.tsx` に保持する。アプリ内の画面遷移では保持し、ページ再読み込みでリセットする。

Debug画面の操作は `useDebugObservation`・`useManualOrientation`・`useDebugView` に分ける。位置情報や時刻モードが変わると月へ視点を合わせ、現在時刻の定期更新ではドラッグした視点を維持する。

AR画面の準備状態・地平線判定・案内・投影・背景の視差は `pages/ar/useARView.ts` が組み合わせる。月が地平線下にある場合も診断値を計算し、方向案内は表示しない。

通常画面の観測時刻は既存どおり `shared/time/observationTime.ts` の固定時刻設定に従う。Debugの現在時刻モードは端末時刻を使用する。

## 検証

```sh
npm test -- --run
npm run build
npm run lint
```

PowerShellの実行ポリシーで `npm.ps1` が起動できない場合は `npm.cmd` を使う。

実機での北基準確認は [north-reference.md](./north-reference.md) を参照する。
