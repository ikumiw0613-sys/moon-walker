# Moon transform pipelineの比較手順

Debugの既存moon transform表示を「Moon transform pipeline」に集約した。本番の天文計算、姿勢、北補正、moonInDevice、投影、MoonSpriteは修正していない。加速度と動的northCorrectionも追加の補正へ使わない。

## 値の出所

- Astronomy: 既存useDebugObservationがgetMoonPositionで取得した月、同じ計算に使った観測時刻・緯度・経度を表示する。診断側で天文計算をやり直さない。
- Device: getMoonDeviceStateのcorrectedRotationを既存getCameraForward / cameraVectorToViewAnglesへ渡す。真上・真下のheadingは共通変換の有効性判定に従ってnullにし、altitudeは保持する。
- moonWorld / moonInDevice / navigation: getMoonDeviceStateの出力をそのまま参照する。式は `moonInDevice = transpose(correctedRotation) * moonWorld`。診断側で別の逆変換を作らない。
- Projection: 追加したgetMoonProjectionDiagnosticsが既存projectMoonToScreenを呼び、その最終出力を参照する。FOVも既存定数90°/60°を参照する。
- normalizedX/Y: 本番最終出力を `2*screenX−1` / `1−2*screenY` で逆算する。投影式の別実装はなく、浮動小数点の丸め誤差がある。depthは−z。背面/カメラ平面では本番が途中でreturnするためnormalized値はnullで、その理由を表示する。最終出力は既存どおり(0.5,0.5,false)。
- MoonSprite: 上記screenX/Y/visibleがそのままpropsになる。left=x×100%、top=y×100%、translate(−50%,−50%)で、基準は画面全体ではなくARの `.mw-ar-viewport`。

visibleは画角内判定で、地平線判定とは別。地平線下でも診断のprojectionやnavigationは計算されるが、本番ARは案内とMoonSpriteを表示しない。また、ARは姿勢activeの場合だけ北補正を渡し、[姿勢信頼度](pose-stability.md)がstableの場合だけ案内を表示する。従来のDebug変換経路は変えず、manual入力・inactive姿勢・pose不安定など本番表示との条件差をMoonSprite欄に明記する。この欄は現在のDebug入力に基づく描画資格の説明であり、別画面の実DOMを取得した値ではない。

null・非有限値・不正な長さは0で埋めず、各段階に理由を表示する。screen出力がオーバーフローした場合も診断結果を算出不可とする。本番の無効入力処理は変えていない。

## 正常時A / ズレ時B

1. 実機Debugで現在地取得、現在時刻、実機センサーを選ぶ。手動テストはOFFにする。北補正は従来の操作で合わせ、比較中に変更しない。
2. AとBで可能な限り同じ端末姿勢に戻し、それぞれ「Moon diagnostics をコピー」を押す。観測時刻、場所、orientation source/status、保存済みnorthCorrectionも一緒に記録される。
3. Clipboard APIが使えない場合は、折りたたみ欄のテキストを選択してコピーする。ボタンを押した時点の値を固定するので、センサー更新や時刻更新後もコピー対象は変わらない。新しい値を取得するにはもう一度ボタンを押す。
4. 同じ入力条件を保ってAR側の月表示と照合する。Debug下部の2Dプレビューは別経路なので、ARのprojection検証にはこのpipeline欄を使う。Debug/ARの現在時刻更新周期は異なるため、時刻差を必ず確認する。

| 順序 | 比較する値 | 切り分ける対象 |
| --- | --- | --- |
| 1 | observationTime、latitude/longitude、moon.azimuth/altitude/isAboveHorizon | 時刻・位置・天文入力の差 |
| 2 | correctedHeading / correctedAltitude、cameraForward、correctedRotation | 3D姿勢・保存済み北基準の差 |
| 3 | moonWorldと長さ | 天文方向からENUベクトルまで |
| 4 | moonInDeviceと長さ、変換前後の長さ | world→deviceの回転変換 |
| 5 | depth、normalizedX / normalizedY、FOV | カメラ前後・投影スケール |
| 6 | screenX / screenY / visible | 0〜1のviewport位置・画角内外 |
| 7 | angleToMoon、navigation.status/arrow/message | 3D方向と案内の整合 |
| 8 | 同じx/y/visibleを渡したMoonSpriteの実表示 | viewport・CSS・描画条件 |

正面はmoonInDevice≃(0,0,−1)、depth≃1、normalizedX/Y≃0、screenX/Y≃0.5。右はscreenX>0.5、上はscreenY<0.5。moonWorldとmoonInDeviceは概ね長さ1で、回転により長さは変わらない。数値が同じなのに実表示が異なる場合は、MoonSpriteへ渡されたprops、親viewportの位置/大きさ、描画条件を調べる。
