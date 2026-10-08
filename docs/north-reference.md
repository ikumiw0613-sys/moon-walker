# Debug / AR の北基準

## 採用した経路

実機で位置が合っていた太陽プレビューのセンサーモードは、次の経路を使っていた。

1. DebugPage が alpha / beta / gamma を deviceOrientationToMatrix に渡す。
2. getCalibratedCameraDiagnostics が保存済み northCorrection を使い、correctedRotation = Rz(northCorrection) × deviceRotation を作る。
3. cameraForwardCorrected = correctedRotation × (0, 0, −1) を得る。
4. correctedHeading は atan2(East, North) を0以上360未満に正規化した値。
5. SunDebugCard が correctedHeading と cameraForwardCorrected を受け取り、SunPreview が補正後の方位・高度で既存の2D投影を行う。

compassHeading はキャリブレーション時の基準、および headingError の比較値だった。太陽プレビューは独自 northOffset を使っていなかった。AR の既存3D変換も保存済み northCorrection を使う同じ行列の方式だった。

一方、従来の DebugPage の月は未補正の行列から moonInDevice を計算し、月プレビューは getDeviceView のライブコンパス補正、または独自 northOffset を使っていた。この月側の分岐を解消した。

## 共通関数

- src/lib/northReferencedDevice.ts
  - getNorthReferencedDeviceRotation: 太陽で確認した行列補正を移植。補正行列、逆行列、カメラ方向、方位、高度、比較誤差を返す。
  - getCameraView: カメラ方向の方位・高度への変換。太陽プレビューもこの関数を使う。
  - getCelestialDirectionInDevice: 補正済み行列の転置で世界方向を端末座標へ変換する。
- src/lib/moonDeviceNavigation.ts
  - getMoonDeviceState: 姿勢と保存補正、天文計算済みの月を入力し、Debug / AR 共通の correctedHeading / correctedRotation / moonInDevice / angleToMoon / navigation を返す。
  - getMoonDeviceDiagnosticAttributes: 両画面の main 要素に非表示の診断属性を付ける。

計算式は moonInDevice = transpose(correctedRotation) × moonWorld、angleToMoon = acos(−moonInDevice.z / ベクトル長)。北補正は一度だけ行う。ライブコンパスや absolute フラグから表示時の追加補正を作らない。

保存先は NorthCalibrationProvider の northCorrection に統一。画面遷移では保持され、従来どおりページ再読み込みでリセットされる。「この方向を北にする」操作も getHorizontalCalibration と captureNorthCalibration を経由して同じ保存先を使う。独自 northOffset と旧 deviceOrientationDiagnostics を削除した。旧 getCalibratedCameraDiagnostics の補正を新しい共通関数に移し、既存のテストを移行した。

Debug の moon transform とセンサーモードの案内は共通出力を表示する。マウス操作の仮想視点は検証用に残してある。太陽・月の2Dマーカー投影、ARリングの位置とデザイン、天文計算、センサーの取得方法は変更していない。ARは地平線下の月の診断値も計算するが、従来どおり方向案内を表示しない。

## 実機確認

1. DebugPage を開き、現在地を取得する。「現在時刻」を選び、PCの手動テストをOFFにする。
2. センサーを有効にし、背面カメラを地平線に近い方向へ向けて「北基準を合わせる」を押す。
3. 太陽プレビューを「北補正済みの端末方向に連動」するモードにする。「太陽を正面にする」は仮想視点なので実機検証には使わない。影などで太陽の方向を確認する。
4. 月プレビューも「スマホの向きで操作する」にする。correctedHeading、correctedRotation、moonInDevice、angleToMoon を記録する。
5. 端末姿勢を維持したまま、再読み込みせずアプリ内の履歴移動またはルート移動で ARPage に切り替える。アドレス入力による再読み込みでは補正が失われる。
6. AR の案内が同じ北基準に従うかを確認する。太陽のマーカーはARには追加していないので、太陽の方向はDebugの補正後方位と照合する。
7. 北→東→南→西→北の各姿勢でも繰り返す。0/360°付近では方位が自然につながることを確認する。

両画面の診断値はリモート開発者ツールで次のように取得できる。Debug画面で debugSnapshot、AR画面で arSnapshot として保存する。

```js
const readMoonDiagnostics = () => {
  const data = document.querySelector('main').dataset;
  return {
    observationTime: data.observationTime,
    deviceRotation: JSON.parse(data.deviceRotation),
    correctedHeading: JSON.parse(data.correctedHeading),
    correctedRotation: JSON.parse(data.correctedRotation),
    moonInDevice: JSON.parse(data.moonInDevice),
    angleToMoon: JSON.parse(data.angleToMoon),
  };
};
// Debugで実行
const debugSnapshot = readMoonDiagnostics();
// 再読み込みせずARに移動して実行
const arSnapshot = readMoonDiagnostics();
console.log({ debugSnapshot, arSnapshot });
```

完全一致の前提は同じ計算時刻・同じセンサー入力・同じ現在地・同じ保存補正。実機の連続測定ではセンサーの揺れと時刻差を確認する。現在時刻の更新間隔は従来どおりDebugが1秒、ARが10秒。診断属性の observationTime と deviceRotation を確認して入力差と計算差を区別する。真上・真下では方位は null だが、補正行列と3Dの月方向は有効。

## 自動テスト

DeviceReferenceParity.test.tsx は実際のDebug / ARコンポーネントを同じ現在時刻・現在地・姿勢で描画し、補正を保存して画面遷移させ、4つの診断出力が一致することを検証する。コンパスの変化、手動北合わせの保存先、未校正、PCの手動姿勢も検証する。

northReferencedDevice.test.ts は北・東・南・西、0/360°境界、傾いた姿勢、二重補正の回避、欠測、天頂・天底を検証する。既存の方位と回転行列の固定値テストも維持した。
