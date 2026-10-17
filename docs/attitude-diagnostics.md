# Debugの姿勢診断

加速度はDebugPageだけの `useDebugDeviceMotion` が取得する。AR・月位置・月相・northCorrectionの保存/適用・キャリブレーション・既存の復帰処理への入力は増やしていない。

## 座標と計算

既存の `deviceRotation.ts` は `Rz(alpha) × Rx(beta) × Ry(gamma)`、`northReferencedDevice.ts` は `correctedRotation = Rz(northCorrection) × deviceRotation` を端末→ENUの回転として使う。ENUは東/北/上、端末は右/上端/画面手前が正で、背面カメラ前方は−Z。したがって、下向き重力の端末座標は `transpose(correctedRotation) × (0, 0, −1)`。北補正を再適用せず、画面の縦横による軸変換も加えない。

[W3C Device Orientation and Motion](https://www.w3.org/TR/orientation-event/) の静止・画面上向きの例では `accelerationIncludingGravity = (0, 0, +9.8)`。この値は重力に逆らう加速度なので、実際の下向き重力を得るには符号を反転する。

1. センサーの生値を `previous × 0.9 + current × 0.1` で平滑化する。初回は現在値で初期化する。
2. 平滑化後のベクトルを正規化し、符号を反転してGravity sensorとする。
3. 行列由来の重力も正規化し、`acos(clamp(dot(sensor, calculated), −1, 1))` を度で表示する。

係数と受信期限、長さの閾値は `gravityDiagnostics.ts` に分離した。生値/平滑化値が欠測・非有限値、長さが4.9〜14.7 m/s²の範囲外、未取得、5秒の更新停止、権限拒否、姿勢未更新、未校正、手動姿勢モードでは角度差を出さず理由を表示する。範囲は異常な値を避ける診断上の目安で、静止を保証しない。停止/不正値の後はフィルタを初期化し、古い姿勢を混ぜない。復帰時にも鮮度を確認する。

## 実機のA/B比較

1. HTTPSでDebugを開き、位置取得後に「現在時刻」を選ぶ。PCの手動テストはOFFにする。
2. 既存の「センサーを有効にする」に加え、「加速度センサーを有効にする（Debug専用）」を押し、必要なiOS権限を許可する。北基準は既存の手順で保存する。
3. 月位置が正常な状態A、ズレた状態Bでそれぞれ数秒静止し、端末姿勢・場所・観測時刻・保存済み補正も記録する。同じ姿勢に戻して比べると差を判断しやすい。比較中に再キャリブレーションや再読み込みを挟むと北基準が変わるので、その有無も記録する。
4. `moon transform` と `姿勢診断 / Gravity` を各状態で記録する。

| 比較する値 | 見ること |
| --- | --- |
| correctedHeading / correctedAltitude | 同じ実姿勢なのに計算値が変わっていないか |
| Gravity sensor / Gravity from correctedRotation / Gravity difference | 静止後も傾きが食い違っていないか。算出不可の理由も記録する |
| moon azimuth / altitude / moonWorld | 観測時刻・位置の違いが月の入力に反映されていないか |
| moonInDevice | 正面なら概ね(0, 0, −1)。+xは右、+yは上、zが正なら背面側 |
| moonScreen.x / y / visible | ARと同じprojectMoonToScreenの出力。0〜1が画面範囲、正面は(0.5, 0.5)。背面側は既存仕様で(0.5, 0.5, false) |
| navigation.angleToMoon / status | centered / guiding / behindと3D方向の対応 |

大きい角度差が静止後も続くなら、傾きを含む姿勢・軸・イベント整合性を疑う根拠になる。動作中の差には加速度やフィルタ遅延も含まれる。差が小さくても重力軸まわりの方位（yaw）誤差や保存済み北基準のズレは検出できないので、3D姿勢全体が正しい証明にはならない。方位を実方向と照合したうえで、moonInDeviceとprojectionを追う。

Debug下部の従来の2Dプレビューは方位/高度による別経路。診断のmoonScreenはARの3D投影の値なので混同しない。地平線下でも変換・投影・navigationの計算値を見せるが、本番の地平線判定と案内表示は変更していない。
