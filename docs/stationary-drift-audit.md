# 静止中の方位ドリフト検査（2026-11-08）

対象は「スマホを静止していても時間とともにずれる」という報告。追加情報として、ユーザーはcorrectedHeadingが約1°/分で増加し続けると報告している。コード経路を調査し、既存の本番関数に模擬入力を与えて再現した。生コンパスとの同時時系列はまだ受け取っていないため、実機の発生源は未確定。

## 確認できたこと

### 1. 相対姿勢がずれると保存済み北補正だけでは止まらない

`useDeviceOrientation.ts` は `absolute=false` のイベントも採用する。`northReferencedDevice.ts` の補正は `Rz(saved northCorrection) × deviceRotation` で、現在のwebkitCompassHeadingは比較用のheadingErrorにしか使わない。北補正は校正時に保存した値で、その後の相対yaw基準の変化を追跡しない。

したがって、生コンパスが一定でもalpha側のyawが時間変化すればcorrectedHeadingと月の投影位置は変化する。これはコードから確認できる伝播経路であって、実機のalphaが実際にドリフトしていると断定したものではない。

相対姿勢の基準がジャイロのバイアスで時間変化し得ることは[W3C Orientation Sensorの説明](https://www.w3.org/TR/orientation-sensor/#relativeorientationsensor-model)にも記載されている。これは一般的な相対姿勢の説明で、このアプリがRelativeOrientationSensor APIを使用しているという意味ではない。

### 2. GOOD / stableではゆっくりしたドリフトを除外できない

- `compassDiagnostics.ts`: 直近3秒、最大30件のrangeを評価する。開始時からの累積変化は品質条件に含めない。
- `poseStability.ts`: サンプル間の大きく速い回転、更新停止、重力との大きな不一致を評価する。長期のyawずれは評価しない。
- 重力の方向だけでは地面に対するyawの誤差を識別できない。

このため、2分間で大きくずれても、直近3秒の変化が小さければGOOD / stableが続き得る。GOODやstableは絶対方位が正しいことやドリフトしていないことの保証ではない。

### 3. 再現テスト

`src/features/debug/stationaryDriftAudit.test.ts` に、本番関数を使う5ケースを追加した。固定目標を方位90°・高度0°、初回校正値を−45°とし、60Hzで最大120秒分を検査する。

**0.1°/秒は再現用に与えた例であり、端末から測定したドリフト速度ではない。**

| 模擬入力 | 120秒後 | 現在の判定 |
| --- | --- | --- |
| 姿勢・コンパスとも一定 | correctedHeadingも月マークも一定 | GOOD / stable |
| 相対yawのみ+12°相当、生コンパス一定 | correctedHeading +12°、月方向との角差12° | GOOD / stable |
| 生コンパスのみ+12°、相対姿勢一定 | correctedHeadingと月マークは一定、headingError −12° | GOOD / stable |
| 相対yawと生コンパスが同じ方向へ+12° | correctedHeading +12°、headingErrorは0°、北補正候補も一定 | GOOD / stable |

相対yawだけが変化するケースでは月マークが画面幅の約10.6%動く。直近3秒の北補正候補rangeは0.31°未満なので、品質はGOODのまま。入力を固定した反復では、同じ回転行列・月ベクトル・投影結果が得られ、累積する計算誤差はこの検査では再現しなかった。

別途、報告された約1°/分と同じ速度を相対yawの変化として入力した。60秒後にcorrectedHeadingが+1°となっても、直近3秒の候補rangeは0.051°未満で、GOOD / stableが続くことを確認した。これは実機の発生源を確定するテストではなく、その速度を現行判定が検出できないことの確認。

これらは仮説を検証する特性テストであり、ドリフト対策を実装したテストではない。

## 実機で発生源を分ける

1. Debugで現在地を取得し、手動テストをOFFにする。センサーを有効にする。
2. 可能なら一度北補正を行い、correctedHeadingも読めるようにする。その後は測定終了まで校正しない。
3. スマホ背面を同じランドマークに向け、固定した状態で開始時・30秒後・60秒後に「現在の診断を記録」を押す。押すために端末を動かした場合は、その区間を静止測定として扱わない。
4. 各記録のwebkitCompassHeadingとcorrectedHeading、candidate medianとsaved northCorrectionとの差を比較する。測定時のCompass / North referenceに出るrawHeadingと現在のcandidateは別途メモする（rawHeadingは既存スナップショットの保存項目ではない）。角度の差は最短角差で計算する。

| 静止中の変化 | 主な調査対象 |
| --- | --- |
| 生コンパスは一定、correctedHeadingだけ変化 | alpha等の相対姿勢側の基準変化 |
| 生コンパスだけ変化、correctedHeadingは一定 | コンパス側の再推定・磁気環境・端末処理 |
| 両方が同じ方向へ変化 | 共通のセンサー推定・磁気影響、または端末自体の微動。候補補正が一定でも除外できない |
| 両方一定、月マークだけ変化 | 月の観測時刻と実際の月の移動、画面投影・viewport変化を調査 |

瞬間的な`candidate − saved`は参考になるが、これだけでドリフトとは断定できない。一定の磁北/真北の差も、時間とともに増えるドリフトとは区別する。

実機データなしでの自動再校正やライブコンパス追従は行わない。センサー推定を混ぜると別の誤差を持ち込む可能性があり、最初に生値と補正後を別々に記録する必要がある。

本番のセンサー取得、北補正、キャリブレーション、AR、Moon transform、Astronomyは変更していない。WMMや固定8°の補正も追加適用していない。
