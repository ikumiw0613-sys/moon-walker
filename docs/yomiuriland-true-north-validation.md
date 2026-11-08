# よみうりランドでの北基準の実測診断

Debugの「Landmark / True North Validation」で、既知ランドマークの真方位とSafariの生のコンパス値を比較する。WMMは比較用の表示・仮判定のみ。northCorrection、キャリブレーション、AR、Moon transform、Astronomy、DeviceOrientationの取得処理は変更しない。固定8°補正も行わない。

## 基準ランドマークと座標

現在の観覧車 **Sky-Go-LAND** を使う。2024年開業の新観覧車で、旧「大観覧車」と取り違えないこと。回転するゴンドラではなく、固定の観覧車中心にスマホ背面を向ける。

- 定義: `src/features/debug/landmarks.ts` の `YOMIURILAND_REFERENCE`
- 緯度 **35.6257422** / 経度 **139.5167327**（世界測地系の地図座標）
- 出典: [施設監修の紹介ページ](https://www.gltjp.com/en/directory/item/19105/)の地図・地理座標メタデータ（2026-11-08確認）
- 施設の同定: [よみうりランド公式 Sky-Go-LAND](https://www.yomiuriland.com/attraction/sky-go-land/)

この座標は施設の地図代表点であり、測量済みの軸中心を保証しない。細かい桁数は精度の保証ではない。近距離で数度の差を判別する用途には代表点の誤差も効くため、十分離れた場所を複数選んで検証する。測量した座標が得られたら定数1か所で差し替える。既存の東京スカイツリー診断・記録は残す。

## 真方位と距離

`src/shared/geo/geographicBearing.ts` の既存 `calculateBearing` を再利用する。球面上の initial bearing をatan2で計算し、真北0°・東90°の `[0, 360)` に正規化する。距離は既存 `calculateDistance` のHaversine（地表距離m）。同一点・対蹠点など方位が未確定の場合はnullにする。

```text
difference = wrap180(webkitCompassHeading − trueBearing)
absoluteDifference = abs(difference)
correctedHeadingDifference = wrap180(correctedHeading − trueBearing)
```

wrap180の範囲は `[-180°, 180°)`。359° − 1° = −2°、1° − 359° = +2°。表示は小数1桁、仮判定は丸め前の値を使う。

## WMM

`src/features/debug/magneticDeclination.ts` から `geomagnetism@0.2.0` のWMMを呼ぶ。係数を同梱してブラウザ内で計算するため、実行時の外部API通信は不要。現在の位置と**実際の現在日時（UTC、1分単位）**で評価し、月の固定テスト日時には連動しない。

モデル名、epoch、評価日時、ライブラリ収録モデルの有効期間、unavailable reasonを表示・記録する。2026年の入力では `WMM-2025 / epoch 2025` を使う。このライブラリの収録有効期間は `2024-11-13T03:00:00Z` から `2029-11-13T03:00:00Z`。期間外の外挿は許可しない。欠測や計算失敗を0°や固定偏角で埋めない。

モデル入力の高度はWGS84楕円体高0mを仮定し、表示にも明記する。端末高度を本番の観測点へ反映する変更は行わない。水平磁場が2000nT未満の場合は診断値をunavailableにする。

- [WMM公式説明・制限](https://www.ncei.noaa.gov/products/world-magnetic-model)
- [ライブラリと収録モデル](https://github.com/naturalatlas/geomagnetism)
- [NOAA公式検証値](https://www.ncei.noaa.gov/sites/default/files/2025-02/WMM2025_TEST_VALUES.txt): テストでは2025.0 / 2027.5、東偏と西偏、緯度・経度0°を含む点で検証する。

## 符号と仮判定

WMMの偏角Dは **東偏が正、西偏が負**。真方位Tと磁北方位Mは `T = M + D` なので、磁北基準のセンサーなら `M − T = −D` になる。

したがって、単に `difference − D` を比較すると符号が逆になる。画面にはDそのものに加え、`Expected magnetic difference = −D`、`Magnetic residual = wrap180(difference + D)`を表示する。これは診断残差であり、補正後の方位をARへ渡す処理ではない。

例: 真方位245.8°、偏角−7.5°のとき、磁北値の期待値は **253.3°**、differenceは **+7.5°**。センサーが238.0°を返してdifferenceが−7.8°なら、この符号規約では磁北基準とは一致しないためINCONCLUSIVEとなる。

符号の根拠: [USGSの磁北→真北の換算例](https://www.usgs.gov/educational-resources/why-am-i-adding-one-situation-subtracting-another)。

`src/features/debug/landmarkTrueNorthDiagnostics.ts` の `HEADING_REFERENCE_LIMITS` に閾値をまとめる。

| 条件 | 仮判定 |
| --- | --- |
| `abs(wrap180(difference)) ≤ 3°` のみ成立 | TRUE-NORTH-LIKE |
| `abs(wrap180(difference + D)) ≤ 3°` のみ成立 | MAGNETIC-NORTH-LIKE |
| 両方成立 / どちらも不成立 / 必要データなし | INCONCLUSIVE |

距離50m未満は仮判定停止。500m未満、または `asin(min(1, GPS accuracy / distance))` による方位不確かさ目安が3°超なら「GPS誤差の影響を受けやすい」と警告し、INCONCLUSIVEにする。GPSの目安に対象の代表点誤差や目視の照準誤差は含まれない。

webkitCompassAccuracyは生値を表示し、負値は無効と注記する。accuracy欠測・負値だけで差を破棄しない。センサー更新停止・非表示・手動テスト中は既存の `useCompassDiagnostics` の鮮度判定に従い、生のコンパスを比較に使わない。alphaをコンパス値の代わりに使わない。correctedHeadingは既存出力を参考表示するだけで、校正を要求せず生コンパスを検証できる。

仮判定は、北基準や他の補正の有無を断定しない。一定の磁気干渉・姿勢依存・目視誤差でも似た差が出る。複数の場所・方向・姿勢で再現性を確認する。

## スナップショット

「現在の診断を記録」の `yomiurilandValidation` に対象名・対象座標・現在地座標・位置精度と取得時刻・距離・trueBearing・webkitCompassHeading・webkitCompassAccuracy・compassDifference・absoluteDifference・correctedHeading・correctedHeadingDifference・magneticDeclination・magneticDifference・モデル情報・headingReferenceHypothesis・警告と算出不可理由・timestampを保存する。

クリック時刻は既存記録と新診断で同じ。入れ子の診断値もコピーし、後続の位置・センサー・モデル更新で過去の記録を変えない。記録カード内の「Landmark / True North Validation の記録」から確認できる。既存仕様どおり最新10件の一時保存で、ページ更新やDebugを離れると消える。

## 実機確認手順

1. よみうりランドのSky-Go-LANDが見える場所へ行く。できれば500m以上離れ、金属・磁石の影響が少ない場所を選ぶ。
2. HTTPSのDebugを開く（本番では既存の `VITE_ENABLE_DEBUG=true` のビルドが必要）。
3. 現在地を取得し、センサーを有効にする。手動テストはOFF。生コンパスの診断だけなら北補正は不要。
4. スマホ背面を実際の観覧車の中心へ向ける。
5. 2〜3秒静止する。
6. True bearingを確認する。
7. webkitCompassHeading、Difference、webkitCompassAccuracyを確認する。
8. Magnetic declination、Expected magnetic difference、Magnetic residualを確認する。
9. Heading reference hypothesisとGPS警告を確認する。必要ならcorrectedHeadingの差も比較する。
10. 場所・照準・実際の見え方をメモし、「現在の診断を記録」を押す。
11. 別の場所へ移動して現在地を再取得し、同じように測定する。
