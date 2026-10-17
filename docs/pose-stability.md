# ARの姿勢信頼度

## 方針

既存の端末→ENU回転、保存済みnorthCorrection、moonWorld→moonInDevice、projectMoonToScreen、MoonSpriteの位置計算は維持する。getMoonDeviceStateの生の診断値も残す。姿勢を別の値へ置き換えたり、古い姿勢を保持して案内したりせず、現在サンプルの信頼度でARの案内表示を制限する。

姿勢行列の平滑化は追加していない。Euler角を個別に平均すると359°境界やロールに問題を生み、強い平滑化は持ち替えの追従を遅らせるため、まず急変の隔離と案内の復帰確認を行う。正常な移動・回転の計算経路には遅延を加えない。これはセンサーの生の角度が飛ばない保証ではなく、飛んだ値を確定表示として使い続けない対策。

## 判定

定数は `features/device-orientation/poseStability.ts` に分離した。センサー更新頻度は端末により違うため固定フレーム数ではなく実測経過時間で判定する。初期値はおよそ60Hzの入力で単発ノイズだけを抑える保守的な値で、実機調整の余地がある。

| 判定 | 初期値 |
| --- | --- |
| 急変を調べるサンプル間隔 | 120ms以下 |
| heading jump | 40°以上、かつ900°/秒以上 |
| altitude jump | 35°以上、かつ700°/秒以上 |
| 3D rotation jump | 50°以上、かつ1200°/秒以上 |
| headingの極付近除外 | 高度の絶対値75°以上ではheading差による急変判定を省略 |
| 更新途切れ | サンプル間隔250ms以上 |
| 更新停止 | 新しい姿勢サンプルなしで600ms |
| 復帰 | 正常更新が350ms以上、かつ4サンプル以上継続 |
| gravity mismatch | 25°を超える差が700ms以上継続 |
| 補助重力データの鮮度 | 250ms以内 |
| 重力フィルタの収束確認 | 生値と平滑化値の方向差12°以内 |

heading差は既存normalizeSignedAngleで最短差を求める。359°→1°は2°。回転差はSO(3)の行列間角度から求めるため、ロールも検出できる。天頂/天底付近の方位反転はheadingだけで判定しない。同じ姿勢でも新しい採用イベントなら復帰サンプルになる一方、月時刻更新・UI更新・DeviceMotionだけの更新では姿勢の鮮度を延長しない。バックグラウンドへ移ると信頼度を無効化し、復帰後は新しい更新で確認する。北補正をユーザーが保存し直した場合は、新しい基準として履歴をリセットする。

## 加速度の範囲

DebugのDeviceMotion取得と重力計算を `features/device-motion` へ共通化し、旧Debug APIは再exportで維持した。フィルタは従来の0.9/0.1のまま。回転・方位の平滑化係数ではない。

ARでは符号が確認できるiOS WebKitでのみ補助判定する。rawは下向きとして反転しない。符号未確認のブラウザ、権限未許可/拒否、欠測、古い値、異常なベクトル長は重力比較を省略し、DeviceOrientationだけで判定する。生値と平滑化値の方向差が12°を超える間も、持ち替え中や低頻度入力でのフィルタ遅延として補助判定から除外する。重力との一致が良くてもheading/yawや北基準の正しさは保証しない。

iOSのMotion許可は「動きの補助確認を有効にする」から要求する。許可済みならページ遷移後も取得を再開できる。ARの姿勢不安定中は月Sprite・方向マーカー・near/centeredリング・数値付きの強い案内を隠し、「向きを確認しています…」を表示する。正常更新で自動復帰する。取得した加速度でcorrectedRotationやnorthCorrectionを書き換えない。full sensor fusionは行わない。

centeredの3D判定閾値は既存の5°を維持する。表示は「このあたりに月があります」とし、リングは通常150px、画面の高さ600px以下では110pxの探索目安とした。nearは従来の15°。MoonSpriteへ渡す座標は変更していない。

## 実機確認

1. キャリブレーション後、ARで月の方向を確認する。iPhone/Safariでは必要に応じて補助Motionを許可する。
2. 胸元→顔の前へ持ち替える。腕を伸ばす/縮める。左右へ体ごと回転、上下へ向け、少しロールさせる。正常な連続移動で案内が追従するか確認する。
3. 数度ずれても、リング周辺の実際の空を探せる表示か確認する。
4. 一時的に大きく姿勢を変えて戻す。実際の素早い動きと単発ノイズは完全には識別できないため、一時停止した場合も正常更新から自動復帰するか確認する。
5. DebugのPose stabilityでheading/altitude delta、3D rotation delta、interval、gravity difference、status/reasonを比較する。Moon diagnosticsコピーにもpose.*を含める。
6. 画面を一度バックグラウンドへ移して戻す。既存の再キャリブレーション要求を維持しつつ、古い姿勢で確定案内が出ないか確認する。

## 変更ファイル

- 判定: `src/features/device-orientation/poseStability.ts`、`usePoseStability.ts`、`auxiliaryGravity.ts`。
- 受信識別: `src/features/device-orientation/useDeviceOrientation.ts`（計算・イベント採用条件は維持し、診断イベントのsequenceだけ追加）。
- Motion共通化: `src/features/device-motion/useDeviceMotion.ts`、`gravityDiagnostics.ts`。互換export: `src/features/debug/useDebugDeviceMotion.ts`、`gravityDiagnostics.ts`。
- 案内: `src/features/moon-guide/arGuidanceConfidence.ts`、`src/pages/ar/useARView.ts`、`ARPage.tsx`、`ARPage.css`。
- Debug: `src/pages/debug/DebugPage.tsx`、`src/features/debug/components/PoseStabilityDiagnostics.tsx`、`GravityDiagnostics.tsx`、`src/features/debug/moonPipelineDiagnostics.ts`。
- テスト追加: `src/features/device-orientation/poseStability.test.ts`、`auxiliaryGravity.test.ts`、`src/features/device-motion/useDeviceMotion.test.tsx`、`src/pages/ar/ARPoseStability.test.tsx`。
- 既存テスト更新: `src/features/device-orientation/useDeviceOrientation.test.tsx`、`src/pages/ar/ARPage.test.tsx`、`src/pages/debug/DebugPage.test.tsx`。
- 手順: `docs/pose-stability.md`、`docs/attitude-diagnostics.md`、`docs/moon-transform-pipeline.md`。
