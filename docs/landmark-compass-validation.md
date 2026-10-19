# Landmark compass validation

Debugの既存SkytreeDebugCardを拡張し、Compass stabilityの直後へ移動した。旧Astronomy / landmarks内のスカイツリーカードは削除し、同じ値の二重表示を避けている。

## 再利用する座標・計算

- `src/features/debug/landmarks.ts`の`TOKYO_SKYTREE`: 緯度35.7100152、経度139.8107594。既存の施設代表座標をそのまま使う。
- `src/shared/geo/geographicBearing.ts`の`calculateBearing`: 球面上の初期方位角を真北0°・東90°として[0°, 360°)へ正規化する。
- 同ファイルの`calculateDistance`: Haversineによる地表距離。高度は含まない。
- 同ファイルの`compareHeadingToBearing`: 誤差は「端末方位 − 理論方位」の最短角差[-180°, 180°)。+180°と−180°はいずれも−180°となる。

緯度をφ、経度差をΔλとすると、初期方位角は既存ユーティリティで次の式を使っている（内部はラジアン）。

```text
east  = sin(Δλ) cos(φtarget)
north = cos(φcurrent) sin(φtarget) − sin(φcurrent) cos(φtarget) cos(Δλ)
bearing = normalize360(degrees(atan2(east, north)))
```

GPS未取得・無効座標・同一点・対蹠点などでは方位を表示しない。対象から50m未満でも、位置誤差の影響が大きいため方位と各誤差をunavailableにする。距離は表示する。この距離閾値は`MIN_LANDMARK_DISTANCE_METERS`としてDebug専用ファイル`landmarkCompassDiagnostics.ts`に定数化している。

## 表示と判定

優先表示はLandmark Accuracy、Reference target、Reference bearing、webkitCompassHeading、符号付きCompass error / actual error、Absolute error。詳細には現在地・対象の各緯度経度、現在地の推定精度、距離、Corrected heading、Corrected heading error、補正前の背面方向Raw heading、webkitCompassAccuracyを置いている。

Landmark AccuracyはSafariのaccuracy値とは独立して、目視で対象に向きを合わせた際の実測誤差を評価する。

| 絶対誤差 | 判定 |
| --- | --- |
| 3°以下 | GOOD |
| 3°超〜7°以下 | CAUTION |
| 7°超 | BAD |
| 有効な位置・実機コンパスなし | UNAVAILABLE |

閾値は`LANDMARK_ACCURACY_LIMITS`。表示は小数1桁、判定は丸め前の値を使う。webkitCompassAccuracyはSafariの生値を表示し、負値には無効の注記を付ける。欠測・負値のaccuracyだけを理由にランドマーク誤差は破棄しない。

コンパスは既存`useCompassDiagnostics`の現在の採用実機サンプルを使う。相対イベントへの切り替えなどで無視されたイベント、手動テスト、非アクティブ状態、既存の鮮度閾値を超えたデータは比較に使わない。webkitCompassHeadingがない端末でalpha等を代用しない。Corrected headingとRaw headingは既存Moon device stateの出力を読むだけで、変換し直さない。

Compass Stability / Qualityは時間変動と端末報告の精度を見る。Landmark Accuracyは既知の対象への絶対方位誤差を見る。安定していても一定角度ずれている状態を別々に確認できる。スマホが実際に対象を向いているかは自動検出せず、ユーザーが目視で合わせる。

## スナップショット

既存の「現在の診断を記録」に以下を追加する。

- referenceTarget / referenceBearing
- compassError / correctedHeadingError
- webkitCompassAccuracy（端末の生値）
- landmarkAccuracy / distanceToTarget

既存のcompassHeading、correctedHeading、現在地・取得時刻・観測時刻・月の方位高度・メモも同じ記録に保持する。クリック時点の値を固定し、移動・センサー更新後も過去の誤差は再計算しない。Compass QualityとLandmark Accuracyを別ラベルで表示し、理論方位・コンパス方位・誤差を記録の前面に出す。一時保存・10件上限・更新で消去という既存仕様は維持する。

## 実機確認

1. 東京スカイツリーが見える場所へ行き、Debug画面を開く。
2. 現在地を取得し直し、実機センサーを有効にする。手動テストはOFFにする。
3. 実際にスマホの背面をスカイツリーへ向け、数秒静止する。
4. Reference bearing、webkitCompassHeading、Compass errorを確認する。
5. 詳細のwebkitCompassAccuracy、Corrected heading error、距離も確認する。
6. 「開けた場所、Moon OK」などをメモし、「現在の診断を記録」を押す。
7. 別の場所で現在地を再取得し、同じ手順を繰り返す。
8. 月のズレとCompass errorの大きさ・傾向が対応するか比較する。

ランドマークに向けている時と月に向けている時の値は同じ瞬間には測れないため、それぞれの状況をメモして比較する。目視の合わせ方・GPS誤差・端末の北基準や構え方も含む検証であり、BADだけでコンパスが原因だと確定しない。

本番AR、northCorrection、キャリブレーション条件、DeviceOrientation、Astronomy、Moon transformは変更しない。この判定は自動補正・動的補正・キャリブレーション拒否には使用しない。
