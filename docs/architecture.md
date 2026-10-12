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
│  ├─ moon/                    # 天文計算・月齢と月相・月の型・月の出の書式
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

`features/moon/moonPhase.ts` の `getMoonPhase(date)` は、指定時刻の月齢 `ageDays`・月相角 `cycleAngle`・照明率 `illuminatedFraction` を返す。月齢は直前の新月からの経過日数、月相角は新月0°・満月180°の0〜360°未満、照明率は明るい部分の割合を0〜1で表す。月齢の日数から照明率を近似せず、それぞれを `astronomy-engine` で計算する。React・位置情報・現在時刻の取得を含めず、後続の影描画や画面から同じ観測時刻を渡して利用する。

`features/moon/components/MoonDisc.tsx` は、画像と影を重ねる共通の表示領域。`moonDiscGeometry.ts` で100×100の座標、中心(50, 50)、半径50を定義する。透明な余白を含む `public/moon-image.png` の月の円盤をこの領域に合わせ、円形の `clipPath` で画像と追加のSVG要素を一緒に切り抜く。ARの月本体と画面端のマーカーは同じ部品を使い、表示サイズだけを親要素で指定する。元画像を差し替えた場合は、`SOURCE_MOON_IMAGE` の実寸・中心・直径を再計測する。

`features/moon/moonShadow.ts` の `getMoonShadowPath(phase)` は、月相角と照明率から影の閉じたSVGパスを生成する純粋関数。円盤の外周と、横半径が `半径 × |2 × 照明率 - 1|` の楕円状の明暗境界を組み合わせ、影の面積を円盤の `1 - 照明率` に合わせる。照明率0では全面を覆い、0.5では半円と直線、1では影がないため `null` を返す。向きを固定した模式表示として、満ちていく月は右、欠けていく月は左を明るくする。影の傾き・色・不透明度・ぼかしは描画側で扱う。

`features/moon-guide/moonDeviceNavigation.ts` の `getMoonDeviceState` は、センサー姿勢・観測地点から計算した月・保存済み北補正を受け取り、DebugとAR共通の計算結果を返す。北補正は一度だけ適用する。

北補正の状態は `features/north-calibration/NorthCalibrationProvider.tsx` に保持する。アプリ内の画面遷移では保持し、ページ再読み込みでリセットする。

Debug画面の操作は `useDebugObservation`・`useManualOrientation`・`useDebugView` に分ける。位置情報や時刻モードが変わると月へ視点を合わせ、現在時刻の定期更新ではドラッグした視点を維持する。

AR画面の準備状態・地平線判定・案内・投影・背景の視差は `pages/ar/useARView.ts` が組み合わせる。月が地平線下にある場合も診断値を計算し、方向案内は表示しない。

通常画面は `shared/time/ObservationTimeProvider.tsx` が保持する一つの観測時刻を、`useObservationTime` で共有する。初期状態は端末の現在時刻で、10秒ごとの更新と画面への復帰時に最新の時刻へ更新する。キャリブレーション画面でテスト日時を選ぶと、固定時刻を画面遷移後も保持し、現在時刻に戻す操作では即時更新する。再読み込みで現在時刻に戻る。Providerなしの単独描画ではHookが現在時刻を更新する。

`pages/ar/useARView.ts` は、共有された同じ `now` から月の位置と月相を計算する。位置情報が未取得でも月相は日時だけで計算できるため、`moonPhase` を返す。後続の影描画はこの結果を利用し、独自に現在時刻を取得しない。Debugの固定日時・現在時刻モードは検証用として独立しており、現在時刻モードは端末時刻を使用する。

## 検証

```sh
npm test -- --run
npm run build
npm run lint
```

PowerShellの実行ポリシーで `npm.ps1` が起動できない場合は `npm.cmd` を使う。

実機での北基準確認は [north-reference.md](./north-reference.md) を参照する。
