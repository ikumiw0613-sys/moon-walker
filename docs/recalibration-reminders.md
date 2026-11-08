# AR の向き再調整案内

既存の `NorthCalibrationProvider` が、保存済みの `calibratedAt` と再調整状態を管理する。
補正値の自動更新、方位変化からのドリフト推定、WMM補正は行わない。

## 任意の推奨

`recalibrationPolicy.ts` に閾値を定義している。

| 理由 | 条件 |
| --- | --- |
| `stale-calibration` | 校正完了から5分。月の観測時刻ではなく実際の経過時間で判定する |
| `screen-orientation-changed` | Screen Orientation API の change、または従来の orientationchange |
| `prolonged-instability` | ARで向きセンサーがactiveかつposeが連続15秒間unstable。安定に戻ると計時を取り消す |

推奨だけでは校正を無効化せず、`needsRecalibration` も立てない。
ARガイドなどの下部に小さな案内を追加し、中心合わせの表示を優先する。
「向きを再調整」から既存の `/calibration` に移動できる。自動遷移はしない。

案内は閉じられる。同じ校正中、同じ理由では再表示しない。
別の理由が新たに発生した場合は再表示する。画面遷移では閉じた状態も保持する。
再校正成功で、理由・閉じた状態・経過時間をリセットする。

## 必須の再校正

`needsRecalibration` は引き続き必須状態だけを表し、別に `requiredRecalibrationReason` を持つ。

| 理由 | 条件 |
| --- | --- |
| `resumed-from-background` | 既存どおりvisibilityがhidden、またはpagehideで保存済み校正を無効化。復帰だけでは再有効化しない |
| `orientation-recovered` | AR内でセンサーがunavailable/error/denied/unsupportedを経た後にactiveへ復帰 |
| `sensor-source-changed` | AR内で受理済みイベントの種類またはabsoluteフラグが変更された |
| `invalid-calibration` | 保存しようとする補正値・時刻が非有限、または時刻が負 |

初回のセンサー待ち・権限要求だけでは復帰と扱わない。
必須状態では従来どおり保存済み校正を無効化するが、画面を強制遷移させず再調整へのリンクを表示する。
背景移行時の既存動作を維持するため、背景復帰は今回も任意の推奨には格下げしない。

## 実機確認

1. 校正してARを開き、直後は新しい案内がないことを確認する。
2. 5分使用し、案内が出ても月の表示や中心合わせが継続することを確認する。
3. 案内を閉じ、同じ理由で繰り返し出ないことを確認する。
4. 画面を回転し、新しい理由で案内が出ることを確認する。
5. 再調整ボタンから既存の校正を完了し、案内が消えることを確認する。
6. アプリを背景へ移して復帰し、従来どおり必須の再校正案内になることを確認する。

時刻・画面回転・不安定状態と、必須状態、閉じた状態、ARのガイド・投影値の維持は自動テストでも確認する。
実際のドリフト量や絶対方位の正しさをこの案内から判断することはできない。
