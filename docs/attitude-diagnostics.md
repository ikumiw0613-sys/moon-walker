# Debugの姿勢診断

加速度取得・重力計算は共通の `features/device-motion` にあり、Debugの `useDebugDeviceMotion` は互換APIを維持する。ARでも姿勢の信頼度確認だけに使用できるようにした（[姿勢信頼度](pose-stability.md)）。月位置・月相・correctedRotation・northCorrectionの保存/適用・キャリブレーションの補正には使わない。

## 座標と計算

既存の `deviceRotation.ts` は `Rz(alpha) × Rx(beta) × Ry(gamma)`、`northReferencedDevice.ts` は `correctedRotation = Rz(northCorrection) × deviceRotation` を端末→ENUの回転として使う。ENUは東/北/上、端末は右/上端/画面手前が正で、背面カメラ前方は−Z。したがって、下向き重力の端末座標は `transpose(correctedRotation) × (0, 0, −1)`。北補正を再適用せず、画面の縦横による軸変換も加えない。

### DeviceMotionの符号は実装を区別する

前の診断はW3Cの例だけを根拠に一律で符号を反転していた。これはiPhone / Safariに適用できない。座標軸の定義と、加速度値に含まれる重力項の符号は別々に確認する必要がある。

- [AppleのDeviceMotion accelerationの定義](https://developer.apple.com/documentation/webkitjs/devicemotionevent/1629483-acceleration)は +x=端末右、+y=端末上端、+z=画面から出る向き。このアプリの端末軸と一致する。画面を上にして水平に置いた物理Downは(0, 0, −1)、上端を上にして立てた物理Downは(0, −1, 0)。画面表示のCSS座標へ変換しない。
- [iOS WebKit WebCoreMotionManager.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/ios/WebCoreMotionManager.mm#L212-L227)は `totalAccel = userAcceleration + gravity` とし、Core Motionのgravityを反転せず9.80665倍して渡す。[DeviceMotionClientIOS.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/ios/DeviceMotionClientIOS.mm#L90-L115)も、この3成分をそのままaccelerationIncludingGravityへ渡す。静止時のこの重力項はDownなので、iPhone / Safariでは反転しない。
- 一方、[W3C Device Orientation and Motion](https://www.w3.org/TR/orientation-event/#introduction)の静止・画面上向きの例は `accelerationIncludingGravity = (0, 0, +9.8)`。この符号規約では反転すると物理Downになる。W3Cの例をiOSの実測値へ無条件に適用しない。

今回の確認対象はユーザーから報告されたiPhone / Safariなので、診断の既定は「反転なし（rawがDown）」。別の符号規約も検証できるよう、Gravityカード内にDebug専用の選択欄を置いた。UA判定や、correctedRotationとの角度差が小さい側の自動採用はしない。設定はカード内だけに保持し、northCorrectionへ保存せず、ARへも渡さない。

1. センサーの生値を `previous × 0.9 + current × 0.1` で平滑化する。初回は現在値で初期化する。
2. 平滑化後のベクトルを正規化し、選択した符号でGravity sensorを求める。iPhone / Safariの既定では反転しない。W3Cの例の符号規約では反転する。
3. 行列由来の重力も正規化し、`acos(clamp(dot(sensor, calculated), −1, 1))` を度で表示する。

フィルタ前の `Normalized raw / 反転なし・フィルタ前` も表示する。「符号比較」の2つの角度は、どちらも同じ平滑化値と同じ行列Downで計算する。符号選択を切り替えても、この2つの比較値は変わらない。

提供された値の再現テスト:

| 対象 | 反転なしと行列Downの差 | 反転ありと行列Downの差 |
| --- | --- | --- |
| raw=(0.3202, −10.8923, 0.5620) | 約3.5047° | 約176.4953° |
| 表示された反転後の平滑化方向=(0.0210, 0.9985, −0.0513)から反転前を復元 | 約2.2598° | 約177.7402° |

比較対象の行列Downは(−0.0177, −0.9957, 0.0905)。rawの正規化は約(0.029345, −0.998241, 0.051505)で、表示された平滑化後の値とは別のサンプルとして扱う。この数値一致だけで符号を決めず、実装と下記の物理固定姿勢で検証する。

係数と受信期限、長さの閾値は `gravityDiagnostics.ts` に分離した。生値/平滑化値が欠測・非有限値、長さが4.9〜14.7 m/s²の範囲外、未取得、5秒の更新停止、権限拒否、姿勢未更新、未校正、手動姿勢モードでは角度差を出さず理由を表示する。範囲は異常な値を避ける診断上の目安で、静止を保証しない。停止/不正値の後はフィルタを初期化し、古い姿勢を混ぜない。復帰時にも鮮度を確認する。

## 実機のA/B比較

1. HTTPSでDebugを開き、位置取得後に「現在時刻」を選ぶ。PCの手動テストはOFFにする。
2. 既存の「センサーを有効にする」に加え、「加速度センサーを有効にする（Debug専用）」を押し、必要なiOS権限を許可する。北基準は既存の手順で保存する。
3. **correctedRotationから独立して符号を確認する。** 画面を上にして水平に置き、数秒静止する。Downは−z。raw.zが約−9.8なら「反転なし」、約+9.8なら「反転あり」。次に端末上端を上にして立て、Gravity sensorが(0, −1, 0)に近づくか確認する。必要なら画面下向き（Downは+z）、端末右端を下（Downは+x）でも確認する。行列側が異常でも、符号を行列に合わせ直さない。
4. 月位置が正常な状態A、ズレた状態Bで、符号設定を変えずにそれぞれ数秒静止し、端末姿勢・場所・観測時刻・保存済み補正も記録する。同じ姿勢に戻して比べると差を判断しやすい。比較中に再キャリブレーションや再読み込みを挟むと北基準が変わるので、その有無も記録する。
5. `moon transform` と `姿勢診断 / Gravity` を各状態で記録する。

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
